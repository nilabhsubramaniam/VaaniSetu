import { ChangeDetectionStrategy, Component } from '@angular/core';
import { DocumentList } from './document-list/document-list';
import { DocumentUploadForm } from './document-upload-form/document-upload-form';

/**
 * The document-upload page (Phase 7 Milestone 7f) — lets a user paste or
 * type a plain-text document so it can ground future chat replies
 * (Milestones 7a-7d). No file upload (PDF/DOCX parsing is explicitly
 * deferred, docs/DECISIONS.md ADR-036).
 */
@Component({
  selector: 'app-documents-page',
  imports: [DocumentUploadForm, DocumentList],
  templateUrl: './documents.page.html',
  styleUrl: './documents.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DocumentsPage {}
