import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { DocumentService } from '../../core/services/document.service';

/**
 * Plain-text upload form — title + content, no file picker. File-format
 * parsing (PDF/DOCX) is explicitly out of scope
 * (docs/DECISIONS.md ADR-036); the backend only accepts `{title,
 * content}` JSON (docs/openapi/documents.yaml).
 */
@Component({
  selector: 'app-document-upload-form',
  templateUrl: './document-upload-form.html',
  styleUrl: './document-upload-form.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentUploadForm {
  private readonly documents = inject(DocumentService);

  readonly title = signal('');
  readonly content = signal('');
  readonly canSubmit = computed(
    () => this.title().trim().length > 0 && this.content().trim().length > 0,
  );

  onTitleInput(value: string): void {
    this.title.set(value);
  }

  onContentInput(value: string): void {
    this.content.set(value);
  }

  submit(): void {
    if (!this.canSubmit()) {
      return;
    }
    this.documents.upload(this.title(), this.content());
    this.title.set('');
    this.content.set('');
  }
}
