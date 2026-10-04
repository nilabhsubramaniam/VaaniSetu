import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import type { Document, DocumentStatus } from '../models/document.model';
import { DocumentService } from './document.service';

/** How often to re-check the list while any document is still
 * `"pending"` — a self-rescheduling setTimeout rather than setInterval
 * or an RxJS polling operator, matching this codebase's existing
 * raw-setTimeout idiom (see mic-button.ts, conversation.real.service.ts).
 * It stops on its own once nothing is pending; a manual "Refresh" button
 * (document-list.ts) stays available regardless. */
const POLL_INTERVAL_MS = 3000;

/** Wire shape of a document, per docs/openapi/documents.yaml —
 * createdAt is a string on the wire. */
interface DocumentWire {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly status: DocumentStatus;
  readonly createdAt: string;
}

interface DocumentResponseWire {
  readonly document: DocumentWire;
}

interface DocumentsListResponseWire {
  readonly documents: readonly DocumentWire[];
}

/**
 * The real, HTTP-backed `DocumentService` (Phase 7 Milestone 7f) —
 * calls the document-upload API Milestones 7a-7d already built and
 * live-verified. Same public shape as `DocumentMockService`, so
 * `app.config.ts` swapping `useClass` is the only change anything else
 * needs (ADR-009's precedent).
 */
@Injectable({ providedIn: 'root' })
export class DocumentRealService implements DocumentService {
  private readonly http = inject(HttpClient);

  private readonly _documents = signal<readonly Document[]>([]);
  readonly documents = this._documents.asReadonly();

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  private pollHandle?: ReturnType<typeof setTimeout>;

  constructor() {
    this.refresh();
  }

  upload(title: string, content: string): void {
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle || !trimmedContent) {
      return;
    }

    this._loading.set(true);
    this.http
      .post<DocumentResponseWire>(`${environment.apiBaseUrl}/v1/documents`, {
        title: trimmedTitle,
        content: trimmedContent,
      })
      .subscribe({
        next: (res) => {
          this._loading.set(false);
          this._error.set(null);
          this._documents.update((docs) => [documentFromWire(res.document), ...docs]);
          this.schedulePollIfNeeded();
        },
        error: (err: HttpErrorResponse) => {
          this._loading.set(false);
          console.error('document upload failed', err);
          this._error.set('Could not upload the document. Please try again.');
        },
      });
  }

  refresh(): void {
    clearTimeout(this.pollHandle);
    this._loading.set(true);
    this.http.get<DocumentsListResponseWire>(`${environment.apiBaseUrl}/v1/documents`).subscribe({
      next: (res) => {
        this._loading.set(false);
        this._error.set(null);
        this._documents.set(res.documents.map(documentFromWire));
        this.schedulePollIfNeeded();
      },
      error: (err: HttpErrorResponse) => {
        this._loading.set(false);
        console.error('failed to load documents', err);
        this._error.set('Could not load your documents. Please try again.');
      },
    });
  }

  /** Reschedules itself only while at least one document is still
   * `"pending"` — otherwise there is nothing left to notice, and polling
   * forever would be wasteful. */
  private schedulePollIfNeeded(): void {
    clearTimeout(this.pollHandle);
    const stillPending = this._documents().some((d) => d.status === 'pending');
    if (!stillPending) {
      return;
    }
    this.pollHandle = setTimeout(() => this.refresh(), POLL_INTERVAL_MS);
  }
}

function documentFromWire(wire: DocumentWire): Document {
  return {
    id: wire.id,
    title: wire.title,
    content: wire.content,
    status: wire.status,
    createdAt: new Date(wire.createdAt),
  };
}
