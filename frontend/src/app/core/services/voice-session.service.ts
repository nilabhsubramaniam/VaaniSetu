import type { Signal } from '@angular/core';
import type { VoiceState } from '../models/voice-state.model';

/**
 * Holds the single `VoiceState` shared by the mic button, the voice-state
 * indicator, and the conversation service. Abstract class used as an
 * interface + DI token, same pattern as `ConversationService`.
 *
 * Phase 1 has exactly one writer path in practice (the mic button sets
 * `listening`; `ConversationService` drives `processing` → `responding` →
 * `idle` for both voice and text input) but `setState` is intentionally a
 * single primitive rather than one method per transition — the state names
 * are the real contract (`docs/ROADMAP.md` Phase 1), not the call sequence.
 */
export abstract class VoiceSessionService {
  abstract readonly state: Signal<VoiceState>;
  abstract setState(next: VoiceState): void;
}
