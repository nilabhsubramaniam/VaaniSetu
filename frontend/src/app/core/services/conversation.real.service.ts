import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { LanguageCode } from '../models/language.model';
import type { Turn, TurnRole } from '../models/turn.model';
import type { VoiceCode } from '../models/voice.model';
import { AudioPlaybackService } from './audio-playback.service';
import { ConversationService } from './conversation.service';
import { SettingsStore } from './settings.store';
import { SpeechService } from './speech.service';
import { VoiceSessionService } from './voice-session.service';

/** How long the reply stays in `responding` before settling to `idle` — same
 * pacing as ConversationMockService, so the state is actually perceptible
 * rather than flashing past on a fast local reply. */
const RESPONDING_DELAY_MS = 700;

/** Wire shape of a turn, per docs/openapi/chat.yaml — createdAt is a string
 * on the wire; everything else matches Turn field for field. */
interface TurnWire {
  readonly id: string;
  readonly role: TurnRole;
  readonly text: string;
  readonly language: LanguageCode;
  readonly createdAt: string;
  readonly latencyMs?: number;
  readonly script?: string;
}

interface ChatResponseWire {
  readonly userTurn: TurnWire;
  readonly assistantTurn: TurnWire;
}

/** Wire shape of POST /v1/voice/turn's response, per docs/openapi/voice.yaml.
 * `audio` is null when speech synthesis failed — the turns are still valid
 * (docs/DECISIONS.md ADR-020/ADR-024). */
interface VoiceTurnResponseWire {
  readonly userTurn: TurnWire;
  readonly assistantTurn: TurnWire;
  readonly audio: { readonly contentType: string; readonly base64: string } | null;
}

interface HistoryResponseWire {
  readonly turns: readonly TurnWire[];
}

let nextLocalId = 1;
function makeLocalId(): string {
  return `local-${nextLocalId++}`;
}

/**
 * The real, HTTP-backed `ConversationService` — Milestone 2b's frontend
 * half. Same public shape as ConversationMockService (a `turns` signal, a
 * `void sendUserTurn`), so `app.config.ts` swapping `useClass` is the only
 * change anything else needed, per ADR-009.
 */
@Injectable({ providedIn: 'root' })
export class ConversationRealService implements ConversationService {
  private readonly http = inject(HttpClient);
  private readonly voiceSession = inject(VoiceSessionService);
  private readonly speech = inject(SpeechService);
  private readonly audioPlayback = inject(AudioPlaybackService);
  private readonly settings = inject(SettingsStore);

  private readonly _turns = signal<readonly Turn[]>([]);
  readonly turns = this._turns.asReadonly();

  /** Invalidates a reply that arrives after a newer turn has started. */
  private sequence = 0;
  private currentRequest?: Subscription;

  constructor() {
    this.loadHistory();
  }

  private loadHistory(): void {
    this.http.get<HistoryResponseWire>(`${environment.apiBaseUrl}/v1/chat/history`).subscribe({
      next: (res) => this._turns.set(res.turns.map(turnFromWire)),
      error: (err: HttpErrorResponse) => {
        console.error('failed to load conversation history', err);
        this.voiceSession.setState('error');
      },
    });
  }

  sendUserTurn(text: string, language: LanguageCode): void {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    const mySequence = ++this.sequence;
    this.currentRequest?.unsubscribe();

    this.appendTurn({
      id: makeLocalId(),
      role: 'user',
      text: trimmed,
      language,
      createdAt: new Date(),
    });

    this.voiceSession.setState('processing');

    this.currentRequest = this.http
      .post<ChatResponseWire>(`${environment.apiBaseUrl}/v1/chat`, { text: trimmed, language })
      .subscribe({
        next: (res) => {
          if (mySequence !== this.sequence) {
            return; // superseded by a newer turn or an error simulation
          }

          this.appendTurn(turnFromWire(res.assistantTurn));
          this.voiceSession.setState('responding');
          this.speakReply(res.assistantTurn.text, res.assistantTurn.language);

          setTimeout(() => {
            if (mySequence === this.sequence) {
              this.voiceSession.setState('idle');
            }
          }, RESPONDING_DELAY_MS);
        },
        error: (err: HttpErrorResponse) => {
          if (mySequence !== this.sequence) {
            return;
          }
          console.error('sendUserTurn failed', err);
          this.voiceSession.setState('error');
        },
      });
  }

  /** Runs a full spoken turn through the Phase 5 orchestrator endpoint
   * (docs/openapi/voice.yaml, docs/DECISIONS.md ADR-024) — one call that
   * transcribes, generates a reply, and synthesizes it, replacing what
   * used to be a transcribe-then-sendUserTurn-then-synthesize sequence
   * decided client-side (docs/ARCHITECTURE.md §4 forbids that). Unlike
   * `sendUserTurn`, no user turn can be appended optimistically — the
   * transcript isn't known until the response arrives. */
  sendVoiceTurn(audio: Blob, language: LanguageCode, voice: VoiceCode): void {
    const mySequence = ++this.sequence;
    this.currentRequest?.unsubscribe();

    this.voiceSession.setState('processing');

    const url = `${environment.apiBaseUrl}/v1/voice/turn?language=${encodeURIComponent(language)}&voice=${encodeURIComponent(voice)}`;
    this.currentRequest = this.http
      .post<VoiceTurnResponseWire>(url, audio, {
        headers: { 'Content-Type': audio.type || 'application/octet-stream' },
      })
      .subscribe({
        next: (res) => {
          if (mySequence !== this.sequence) {
            return; // superseded by a newer turn or an error simulation
          }

          this.appendTurn(turnFromWire(res.userTurn));
          this.appendTurn(turnFromWire(res.assistantTurn));
          this.voiceSession.setState('responding');

          if (res.audio) {
            this.playSynthesizedAudio(res.audio.base64, res.audio.contentType);
          } else {
            // Non-fatal by design (ADR-020/ADR-024) — the reply is still
            // fully readable as text.
            console.error('voice turn: speech synthesis failed, no audio returned');
          }

          setTimeout(() => {
            if (mySequence === this.sequence) {
              this.voiceSession.setState('idle');
            }
          }, RESPONDING_DELAY_MS);
        },
        error: (err: HttpErrorResponse) => {
          if (mySequence !== this.sequence) {
            return;
          }
          console.error('sendVoiceTurn failed', err);
          this.voiceSession.setState('error');
        },
      });
  }

  simulateError(): void {
    this.sequence++;
    this.currentRequest?.unsubscribe();
    this.voiceSession.setState('error');
  }

  private appendTurn(turn: Turn): void {
    this._turns.update((turns) => [...turns, turn]);
  }

  /** Decodes a base64 audio payload from POST /v1/voice/turn and plays it.
   * Playback failure is logged only, same non-fatal handling as
   * `speakReply`'s. */
  private playSynthesizedAudio(base64: string, contentType: string): void {
    let blob: Blob;
    try {
      const binary = atob(base64);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      blob = new Blob([bytes], { type: contentType });
    } catch (err) {
      console.error('failed to decode synthesized audio', err);
      return;
    }
    this.audioPlayback
      .play(blob)
      .catch((err: unknown) => console.error('speech playback failed', err));
  }

  /** Synthesizes and plays an assistant reply's speech. Fire-and-forget by
   * design: a synthesis/playback failure is logged but never surfaces as
   * the conversation's `error` state — the reply already succeeded and is
   * fully readable as text, so voice output is additive, not required
   * (docs/DECISIONS.md ADR-020). */
  private speakReply(text: string, language: LanguageCode): void {
    this.speech
      .synthesize(text, language, this.settings.preferredVoice())
      .then((audio) => this.audioPlayback.play(audio))
      .catch((err: unknown) => console.error('speech synthesis/playback failed', err));
  }
}

function turnFromWire(wire: TurnWire): Turn {
  return {
    id: wire.id,
    role: wire.role,
    text: wire.text,
    language: wire.language,
    createdAt: new Date(wire.createdAt),
    latencyMs: wire.latencyMs,
    script: wire.script,
  };
}
