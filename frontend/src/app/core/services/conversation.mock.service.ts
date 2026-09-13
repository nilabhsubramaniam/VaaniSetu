import { Injectable, inject, signal } from '@angular/core';
import type { LanguageCode } from '../models/language.model';
import type { Turn } from '../models/turn.model';
import { ConversationService } from './conversation.service';
import { VoiceSessionService } from './voice-session.service';

/** Mock latency, in ms, before the canned reply "arrives". */
const PROCESSING_DELAY_MS = 900;
/** Mock time the reply stays in `responding` before settling to `idle`. */
const RESPONDING_DELAY_MS = 700;

/**
 * One canned reply per language, chosen only to prove that Hindi
 * (Devanagari) and Hinglish (romanized, code-mixed) both render correctly —
 * see `docs/ROADMAP.md` Phase 1, "Indian-language and Hinglish readiness".
 * These strings are not generated; there is no LLM in Phase 1.
 */
const CANNED_REPLIES: Record<LanguageCode, string> = {
  hi: 'नमस्ते! मैं VaaniSetu हूँ। यह अभी एक डेमो जवाब है, असली मॉडल बाद के चरण में जुड़ेगा।',
  hinglish:
    'Hey! Main VaaniSetu hoon. Abhi ye ek demo reply hai — asli local model baad ke phase mein connect hoga.',
  en: "Hi! I'm VaaniSetu. This is a demo reply for now — a real local model connects in a later phase.",
  bn: 'নমস্কার! এটি একটি ডেমো উত্তর।',
  gu: 'નમસ્તે! આ એક ડેમો જવાબ છે.',
  mr: 'नमस्कार! हे एक डेमो उत्तर आहे.',
  ta: 'வணக்கம்! இது ஒரு டெமோ பதில்.',
  te: 'నమస్తే! ఇది ఒక డెమో సమాధానం.',
  kn: 'ನಮಸ್ಕಾರ! ಇದು ಒಂದು ಡೆಮೊ ಉತ್ತರ.',
  ml: 'നമസ്കാരം! ഇത് ഒരു ഡെമോ മറുപടിയാണ്.',
  pa: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ! ਇਹ ਇੱਕ ਡੈਮੋ ਜਵਾਬ ਹੈ।',
  or: 'ନମସ୍କାର! ଏହା ଏକ ଡେମୋ ଉତ୍ତର।',
};

let nextId = 1;
function makeId(): string {
  return `turn-${nextId++}`;
}

@Injectable({ providedIn: 'root' })
export class ConversationMockService implements ConversationService {
  private readonly voiceSession = inject(VoiceSessionService);

  private readonly _turns = signal<readonly Turn[]>([]);
  readonly turns = this._turns.asReadonly();

  /** Invalidates any in-flight mock timers when a new turn starts. */
  private sequence = 0;

  sendUserTurn(text: string, language: LanguageCode): void {
    const trimmed = text.trim();
    if (!trimmed) {
      return;
    }

    const mySequence = ++this.sequence;

    this.appendTurn({
      id: makeId(),
      role: 'user',
      text: trimmed,
      language,
      createdAt: new Date(),
    });

    this.voiceSession.setState('processing');

    const startedAt = performance.now();

    setTimeout(() => {
      if (mySequence !== this.sequence) {
        return; // superseded by a newer turn or an error simulation
      }

      const latencyMs = Math.round(performance.now() - startedAt);

      this.appendTurn({
        id: makeId(),
        role: 'assistant',
        text: CANNED_REPLIES[language] ?? CANNED_REPLIES['en'],
        language,
        createdAt: new Date(),
        latencyMs,
      });

      this.voiceSession.setState('responding');

      setTimeout(() => {
        if (mySequence !== this.sequence) {
          return;
        }
        this.voiceSession.setState('idle');
      }, RESPONDING_DELAY_MS);
    }, PROCESSING_DELAY_MS);
  }

  simulateError(): void {
    this.sequence++; // invalidate any in-flight mock reply
    this.voiceSession.setState('error');
  }

  private appendTurn(turn: Turn): void {
    this._turns.update((turns) => [...turns, turn]);
  }
}
