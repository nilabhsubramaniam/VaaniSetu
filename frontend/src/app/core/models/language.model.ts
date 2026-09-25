/**
 * Language identity used across the UI.
 *
 * Mirrors the long-term language set in `docs/PROJECT_GOAL.md`. `hi` and
 * `hinglish` were enabled in Phase 1; `ml` (Malayalam) joined them in
 * Phase 6 Milestone 6c (see `docs/DECISIONS.md` ADR-028) — its LLM and
 * langid results are strong, but its only real TTS candidate fails badly
 * (proxy WER 100-150% against the <10% target); it ships anyway on the
 * same precedent Hinglish already set (ADR-020's non-fatal TTS failure —
 * text conversation still works, voice output for that turn silently
 * doesn't). The rest are listed so the language selector can show them as
 * "coming soon" without any functionality behind them.
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
  { code: 'ml', label: 'മലയാളം', englishName: 'Malayalam', enabled: true },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', englishName: 'Punjabi', enabled: false },
  { code: 'or', label: 'ଓଡ଼ିଆ', englishName: 'Odia', enabled: false },
];

export function languageLabel(code: LanguageCode): string {
  return LANGUAGE_OPTIONS.find((option) => option.code === code)?.englishName ?? code;
}
