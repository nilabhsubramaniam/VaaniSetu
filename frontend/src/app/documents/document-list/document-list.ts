import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { DocumentService } from '../../core/services/document.service';

/** How much of a document's content to show in the list before
 * truncating with an ellipsis — just enough to recognize it, not a full
 * preview (the upload form already has the full text). */
const PREVIEW_LENGTH = 120;

@Component({
  selector: 'app-document-list',
  templateUrl: './document-list.html',
  styleUrl: './document-list.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentList {
  private readonly documentService = inject(DocumentService);

  readonly documents = this.documentService.documents;
  readonly loading = this.documentService.loading;
  readonly error = this.documentService.error;

  preview(content: string): string {
    const trimmed = content.trim();
    return trimmed.length > PREVIEW_LENGTH ? `${trimmed.slice(0, PREVIEW_LENGTH)}…` : trimmed;
  }

  refresh(): void {
    this.documentService.refresh();
  }
}
