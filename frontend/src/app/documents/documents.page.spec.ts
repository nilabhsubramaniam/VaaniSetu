import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DocumentsPage } from './documents.page';
import { DocumentService } from '../core/services/document.service';
import type { Document } from '../core/models/document.model';

describe('DocumentsPage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: DocumentService,
          useValue: {
            documents: signal<readonly Document[]>([]),
            loading: signal(false),
            error: signal<string | null>(null),
            upload: vi.fn(),
            refresh: vi.fn(),
          },
        },
      ],
    });
  });

  it('renders the page heading and both sections', () => {
    const fixture = TestBed.createComponent(DocumentsPage);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Documents');
    expect(el.querySelector('app-document-upload-form')).not.toBeNull();
    expect(el.querySelector('app-document-list')).not.toBeNull();
  });
});
