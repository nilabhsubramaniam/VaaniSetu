import { Injectable, signal } from '@angular/core';
import type { Document } from '../models/document.model';
import { DocumentService } from './document.service';

/** How long a mock upload stays "pending" before flipping to "ready" —
 * long enough to actually see the transition, short enough not to feel
 * broken in a demo. No real chunking/embedding happens here. */
const MOCK_PROCESSING_DELAY_MS = 1500;

let nextMockId = 1;

/**
 * Local-only `DocumentService`: no network call, a short simulated delay
 * before a document becomes `"ready"` so the UI's pending/ready
 * transition is actually visible without a backend.
 */
@Injectable({ providedIn: 'root' })
export class DocumentMockService implements DocumentService {
  private readonly _documents = signal<readonly Document[]>([]);
  readonly documents = this._documents.asReadonly();

  private readonly _loading = signal(false);
  readonly loading = this._loading.asReadonly();

  private readonly _error = signal<string | null>(null);
  readonly error = this._error.asReadonly();

  upload(title: string, content: string): void {
    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    if (!trimmedTitle || !trimmedContent) {
      return;
    }

    this._error.set(null);
    const id = `mock-doc-${nextMockId++}`;
    const doc: Document = {
      id,
      title: trimmedTitle,
      content: trimmedContent,
      status: 'pending',
      createdAt: new Date(),
    };
    this._documents.update((docs) => [doc, ...docs]);

    setTimeout(() => {
      this._documents.update((docs) =>
        docs.map((d) => (d.id === id ? { ...d, status: 'ready' } : d)),
      );
    }, MOCK_PROCESSING_DELAY_MS);
  }

  refresh(): void {
    // Nothing to fetch — this service's state is already authoritative.
  }
}
