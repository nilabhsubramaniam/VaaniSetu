import type { Signal } from '@angular/core';
import type { ChatLanguageRequest, LanguageCode } from '../models/language.model';
import type { Turn } from '../models/turn.model';
import type { VoiceCode } from '../models/voice.model';

/**
 * Data-access boundary for the conversation.
 *
 * This is an abstract class used purely as an interface + DI token — the
 * Angular-idiomatic way to keep call sites decoupled from the concrete
 * implementation. `docs/ARCHITECTURE.md` requires the AI/voice stack to stay
 * replaceable; this is the seam where Phase 2 swaps `ConversationMockService`
 * for a real Go-backend-backed implementation in `app.config.ts`, with no
 * change to any component.
 */
export abstract class ConversationService {
  /** All turns so far, oldest first. */
  abstract readonly turns: Signal<readonly Turn[]>;

  /**
   * Records a user turn and produces the assistant's reply.
   * The mock implementation simulates the `processing` → `responding`
   * cycle; a real implementation would call the Go backend instead.
   * `language` accepts the "auto" sentinel (docs/DECISIONS.md ADR-030) in
   * addition to a concrete pin — only typed chat supports it so far.
   */
  abstract sendUserTurn(text: string, language: ChatLanguageRequest): void;

  /**
   * Runs a full spoken turn from recorded audio: transcribe, generate a
   * reply, and speak it — one orchestrated call (Phase 5,
   * docs/DECISIONS.md ADR-024), not three sequential ones. The real
   * implementation drives processing -> responding -> idle itself, same
   * as `sendUserTurn`. Unlike `sendUserTurn`, `language` here is always a
   * concrete pin — voice-turn auto-detection is out of scope (ADR-030).
   */
  abstract sendVoiceTurn(audio: Blob, language: LanguageCode, voice: VoiceCode): void;

  /**
   * Dev/demo affordance so the `error` voice state is reachable and
   * verifiable without a real failure to trigger it (`docs/ROADMAP.md`
   * Phase 1, "Error/empty states"). Cancels any in-flight mock reply.
   */
  abstract simulateError(): void;
}
