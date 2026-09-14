/**
 * Language identity used across the UI.
 *
 * Mirrors the long-term language set in `docs/PROJECT_GOAL.md`. Only `hi`
 * and `hinglish` are enabled in Phase 1; the rest are listed so the language
 * selector can show them as "coming soon" without any functionality behind
 * them (see `docs/ROADMAP.md` Phase 6).
 */
export type LanguageCode =
  'hi' | 'hinglish' | 'en' | 'bn' | 'gu' | 'mr' | 'ta' | 'te' | 'kn' | 'ml' | 'pa' | 'or';

export interface LanguageOption {
  readonly code: LanguageCode;
  /** Name shown in the UI, in the language's own script where practical. */
  readonly label: string;
  /** Short English name, used in secondary text and aria-labels. */
  readonly englishName: string;
  readonly enabled: boolean;
}

/**
 * Full language list for the selector. `enabled` reflects the current
 * roadmap phase, not a technical limitation — flipping it to `true` for a
 * given language belongs to Phase 6, once that language passes its
 * `docs/EVALUATION.md` thresholds.
 */
export const LANGUAGE_OPTIONS: readonly LanguageOption[] = [
  { code: 'hi', label: 'हिन्दी', englishName: 'Hindi', enabled: true },
  { code: 'hinglish', label: 'Hinglish', englishName: 'Hinglish', enabled: true },
  { code: 'bn', label: 'বাংলা', englishName: 'Bengali', enabled: false },
  { code: 'gu', label: 'ગુજરાતી', englishName: 'Gujarati', enabled: false },
  { code: 'mr', label: 'मराठी', englishName: 'Marathi', enabled: false },
  { code: 'ta', label: 'தமிழ்', englishName: 'Tamil', enabled: false },
  { code: 'te', label: 'తెలుగు', englishName: 'Telugu', enabled: false },
  { code: 'kn', label: 'ಕನ್ನಡ', englishName: 'Kannada', enabled: false },
  { code: 'ml', label: 'മലയാളം', englishName: 'Malayalam', enabled: false },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', englishName: 'Punjabi', enabled: false },
  { code: 'or', label: 'ଓଡ଼ିଆ', englishName: 'Odia', enabled: false },
];

export function languageLabel(code: LanguageCode): string {
  return LANGUAGE_OPTIONS.find((option) => option.code === code)?.englishName ?? code;
}
