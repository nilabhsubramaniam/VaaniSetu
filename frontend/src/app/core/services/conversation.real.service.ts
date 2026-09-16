import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Subscription } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { LanguageCode } from '../models/language.model';
import type { Turn, TurnRole } from '../models/turn.model';
import { ConversationService } from './conversation.service';
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

  simulateError(): void {
    this.sequence++;
    this.currentRequest?.unsubscribe();
    this.voiceSession.setState('error');
  }

  private appendTurn(turn: Turn): void {
    this._turns.update((turns) => [...turns, turn]);
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
