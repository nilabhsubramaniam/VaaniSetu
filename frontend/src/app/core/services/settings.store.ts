import { Injectable, signal } from '@angular/core';
import type { LanguageCode } from '../models/language.model';
import type { VoiceCode } from '../models/voice.model';

const STORAGE_KEY = 'vaanisetu.settings.preferredLanguage';
const DEFAULT_LANGUAGE: LanguageCode = 'hi';

const VOICE_STORAGE_KEY = 'vaanisetu.settings.preferredVoice';
const DEFAULT_VOICE: VoiceCode = 'female';

/**
 * The pieces of state that genuinely need to persist and be shared across
 * components rather than living in local component state:
 * - The user's language preference (Phase 1). Per `docs/PROJECT_GOAL.md`,
 *   a manual language pin always wins over auto-detection.
 * - The user's TTS voice preference (Phase 4, `docs/DECISIONS.md`
 *   ADR-023) — which of the two real, simultaneously-loaded voices
 *   `ConversationRealService` asks `SpeechService.synthesize` to speak a
 *   reply with.
 *
 * Privacy toggles and the model-selection field are intentionally NOT
 * modeled here: they are visibly non-functional placeholders in Phase 1
 * (see `docs/ROADMAP.md`), so they hold only local component state.
 */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly _preferredLanguage = signal<LanguageCode>(readStoredLanguage());
  readonly preferredLanguage = this._preferredLanguage.asReadonly();

  private readonly _preferredVoice = signal<VoiceCode>(readStoredVoice());
  readonly preferredVoice = this._preferredVoice.asReadonly();

  setPreferredLanguage(code: LanguageCode): void {
    this._preferredLanguage.set(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Private browsing / storage disabled — the preference just won't
      // survive a reload. Not a functional requirement for Phase 1.
    }
  }

  setPreferredVoice(code: VoiceCode): void {
    this._preferredVoice.set(code);
    try {
      localStorage.setItem(VOICE_STORAGE_KEY, code);
    } catch {
      // Same fallback as setPreferredLanguage above.
    }
  }
}

function readStoredLanguage(): LanguageCode {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return (stored as LanguageCode | null) ?? DEFAULT_LANGUAGE;
  } catch {
    return DEFAULT_LANGUAGE;
  }
}

function readStoredVoice(): VoiceCode {
  try {
    const stored = localStorage.getItem(VOICE_STORAGE_KEY);
    return (stored as VoiceCode | null) ?? DEFAULT_VOICE;
  } catch {
    return DEFAULT_VOICE;
  }
}
