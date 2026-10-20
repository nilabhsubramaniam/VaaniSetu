export type DocumentStatus = 'pending' | 'ready' | 'failed';

/**
 * A document the user has uploaded for retrieval-augmented answers
 * (Phase 7 RAG). Matches `docs/openapi/documents.yaml`'s `Document`
 * schema field for field.
 *
 * `status` starts `"pending"` and is flipped by the backend's own async
 * worker (`backend/internal/documents.Worker`, Milestone 7c) once the
 * document has been chunked and embedded — `"ready"` means it can
 * actually ground a chat reply (Milestone 7d), `"failed"` means the
 * worker could not process it. There is no client-side action to retry
 * a failed document; re-uploading it is the only option today.
 */
export interface Document {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly status: DocumentStatus;
  readonly createdAt: Date;
}
