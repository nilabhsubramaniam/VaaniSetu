import type { LanguageCode } from './language.model';

export type TurnRole = 'user' | 'assistant';

/**
 * One utterance in the conversation — either what the user said/typed, or
 * what the assistant replied. Matches the `turns` table columns in
 * `docs/ARCHITECTURE.md` §3.4 (role, language, text, latency), so a real
 * backend response can populate this same type with no UI change.
 *
 * `agentId` is intentionally optional and unused in Phase 1. It exists only
 * so a future multi-model/multi-agent backend (`docs/ARCHITECTURE.md`,
 * long-term vision) can tag which agent produced a turn without requiring a
 * model change here. No logic in this codebase reads or branches on it yet.
 */
export interface Turn {
  readonly id: string;
  readonly role: TurnRole;
  readonly text: string;
  readonly language: LanguageCode;
  readonly createdAt: Date;
  /** Mock latency in ms for assistant turns; undefined for user turns. */
  readonly latencyMs?: number;
  /**
   * The writing system `text` is actually in (e.g. "Devanagari", "Latin"),
   * computed backend-side per turn (Phase 3, docs/DECISIONS.md ADR-017).
   * Undefined only for turns persisted before this field existed. Not
   * rendered anywhere yet — carried through so a future UI (e.g. a
   * per-script font choice) doesn't need a backend change to use it.
   */
  readonly script?: string;
  /** Reserved for a future multi-agent backend. Not used in Phase 1. */
  readonly agentId?: string;
}
