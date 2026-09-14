/**
 * The mic interaction state machine driven by `VoiceSessionService`.
 *
 * `docs/ROADMAP.md` Phase 1 mocks every transition; no audio is captured.
 * The state names are the contract a future real implementation (Phase 3/5)
 * must keep, since every component here renders against this type, not
 * against how a state was reached.
 */
export type VoiceState = 'idle' | 'listening' | 'processing' | 'responding' | 'error';

export interface VoiceStateDescription {
  readonly label: string;
  readonly hint: string;
}

export const VOICE_STATE_DESCRIPTIONS: Record<VoiceState, VoiceStateDescription> = {
  idle: { label: 'Ready', hint: 'Tap the mic or type to start' },
  listening: { label: 'Listening', hint: 'Speak now' },
  processing: { label: 'Thinking', hint: 'Working on a reply' },
  responding: { label: 'Responding', hint: 'Assistant is answering' },
  error: { label: 'Something went wrong', hint: 'Tap the mic to try again' },
};
