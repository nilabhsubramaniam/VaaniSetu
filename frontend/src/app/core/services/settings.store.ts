import { Injectable, signal } from '@angular/core';
import type { LanguageCode } from '../models/language.model';

const STORAGE_KEY = 'vaanisetu.settings.preferredLanguage';
const DEFAULT_LANGUAGE: LanguageCode = 'hi';

/**
 * The one piece of Phase 1 state that genuinely needs to persist and be
 * shared across the header's language selector and the settings page: the
 * user's language preference. Per `docs/PROJECT_GOAL.md`, a manual language
 * pin always wins over auto-detection — this store is where that pin lives.
 *
 * Privacy toggles and the model-selection field are intentionally NOT
 * modeled here: they are visibly non-functional placeholders in Phase 1
 * (see `docs/ROADMAP.md`), so they hold only local component state.
 */
@Injectable({ providedIn: 'root' })
export class SettingsStore {
  private readonly _preferredLanguage = signal<LanguageCode>(readStoredLanguage());
  readonly preferredLanguage = this._preferredLanguage.asReadonly();

  setPreferredLanguage(code: LanguageCode): void {
    this._preferredLanguage.set(code);
    try {
      localStorage.setItem(STORAGE_KEY, code);
    } catch {
      // Private browsing / storage disabled — the preference just won't
      // survive a reload. Not a functional requirement for Phase 1.
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
