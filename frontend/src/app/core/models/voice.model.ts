/**
 * TTS voice identity used across the UI.
 *
 * Mirrors `ai-services/models.yaml`'s `tts.selected` map and
 * `docs/DECISIONS.md` ADR-023: both voices are real, simultaneously-loaded
 * checkpoints on the Python side, not a hint to a single model — picking
 * one here changes which one actually speaks.
 */
export type VoiceCode = 'female' | 'male';

export interface VoiceOption {
  readonly code: VoiceCode;
  readonly label: string;
}

export const VOICE_OPTIONS: readonly VoiceOption[] = [
  { code: 'female', label: 'Female' },
  { code: 'male', label: 'Male' },
];
