import type { Signal } from '@angular/core';
import type { Document } from '../models/document.model';

/**
 * Data-access boundary for uploaded documents (Phase 7 RAG, Milestone 7f).
 *
 * Same "abstract class as interface + DI token" shape as
 * `ConversationService` — the seam where `app.config.ts` swaps
 * `DocumentMockService` for `DocumentRealService` with no component
 * change (docs/ARCHITECTURE.md's replaceability requirement).
 */
export abstract class DocumentService {
  /** Every uploaded document, most recently created first. */
  abstract readonly documents: Signal<readonly Document[]>;

  /** True while a list refresh or upload is in flight. */
  abstract readonly loading: Signal<boolean>;

  /** The last operation's failure message, or null. Cleared by the next
   * successful operation. */
  abstract readonly error: Signal<string | null>;

  /**
   * Uploads a new plain-text document. It appears in `documents`
   * immediately at `"pending"` — chunking/embedding happens
   * asynchronously backend-side (Milestone 7c); `"ready"`/`"failed"`
   * arrives on a later refresh.
   */
  abstract upload(title: string, content: string): void;

  /** Reloads the document list from the backend. */
  abstract refresh(): void;
}
