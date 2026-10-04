import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { DocumentList } from './document-list';
import { DocumentService } from '../../core/services/document.service';
import type { Document } from '../../core/models/document.model';

describe('DocumentList', () => {
  const documents = signal<readonly Document[]>([]);
  const loading = signal(false);
  const error = signal<string | null>(null);
  let refresh: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    documents.set([]);
    loading.set(false);
    error.set(null);
    refresh = vi.fn();
    TestBed.configureTestingModule({
      providers: [{ provide: DocumentService, useValue: { documents, loading, error, refresh } }],
    });
  });

  it('shows an empty hint when there are no documents', () => {
    const fixture = TestBed.createComponent(DocumentList);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.hint')?.textContent).toContain('No documents uploaded yet');
  });

  it('renders one row per document with its status', () => {
    documents.set([
      {
        id: '1',
        title: 'Doc A',
        content: 'a'.repeat(200),
        status: 'pending',
        createdAt: new Date(),
      },
      { id: '2', title: 'Doc B', content: 'short', status: 'ready', createdAt: new Date() },
    ]);

    const fixture = TestBed.createComponent(DocumentList);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const rows = el.querySelectorAll('.row');

    expect(rows.length).toBe(2);
    expect(rows[0].querySelector('.status')?.textContent?.trim()).toBe('pending');
    expect(rows[1].querySelector('.status')?.textContent?.trim()).toBe('ready');
  });

  it('truncates a long content preview', () => {
    documents.set([
      { id: '1', title: 'Doc A', content: 'x'.repeat(200), status: 'ready', createdAt: new Date() },
    ]);

    const fixture = TestBed.createComponent(DocumentList);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.preview')?.textContent?.endsWith('…')).toBe(true);
  });

  it('shows the error message when present', () => {
    error.set('Could not load your documents. Please try again.');

    const fixture = TestBed.createComponent(DocumentList);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    expect(el.querySelector('.error')?.textContent).toContain('Could not load your documents');
  });

  it('calls refresh when the refresh button is clicked', () => {
    const fixture = TestBed.createComponent(DocumentList);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;

    (el.querySelector('.refresh') as HTMLButtonElement).click();

    expect(refresh).toHaveBeenCalled();
  });
});
