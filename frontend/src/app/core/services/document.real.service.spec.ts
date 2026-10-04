import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { DocumentRealService } from './document.real.service';
import { environment } from '../../../environments/environment';

describe('DocumentRealService', () => {
  let httpMock: HttpTestingController;
  let service: DocumentRealService;

  const documentsUrl = `${environment.apiBaseUrl}/v1/documents`;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });

    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(DocumentRealService);
    // Every test starts by satisfying the constructor's list fetch.
    httpMock.expectOne(documentsUrl).flush({ documents: [] });
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  it('loads the document list on construction', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(DocumentRealService);

    const req = httpMock.expectOne(documentsUrl);
    expect(req.request.method).toBe('GET');
    req.flush({
      documents: [
        {
          id: '1',
          title: 'Doc A',
          content: 'content a',
          status: 'ready',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
    });

    expect(service.documents()).toHaveLength(1);
    expect(service.documents()[0]).toMatchObject({ id: '1', title: 'Doc A', status: 'ready' });
    expect(service.documents()[0].createdAt).toBeInstanceOf(Date);
  });

  it('posts a new document and appends the response', () => {
    service.upload('New Doc', 'New content');

    const req = httpMock.expectOne(documentsUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ title: 'New Doc', content: 'New content' });
    req.flush({
      document: {
        id: '2',
        title: 'New Doc',
        content: 'New content',
        status: 'pending',
        createdAt: '2026-01-01T00:00:00Z',
      },
    });

    expect(service.documents()).toHaveLength(1);
    expect(service.documents()[0]).toMatchObject({ id: '2', status: 'pending' });

    // A pending document should trigger another list refresh.
    vi.advanceTimersByTime(3000);
    httpMock.expectOne(documentsUrl).flush({ documents: [] });
  });

  it('ignores an upload with an empty title or content, making no request', () => {
    service.upload('  ', 'content');
    service.upload('title', '   ');
    httpMock.expectNone(documentsUrl);
  });

  it('sets error on a failed upload and does not add a document', () => {
    service.upload('Doc', 'content');

    httpMock.expectOne(documentsUrl).flush('boom', { status: 500, statusText: 'Server Error' });

    expect(service.documents()).toEqual([]);
    expect(service.error()).not.toBeNull();
  });

  it('sets error on a failed refresh', () => {
    service.refresh();

    httpMock.expectOne(documentsUrl).flush('boom', { status: 500, statusText: 'Server Error' });

    expect(service.error()).not.toBeNull();
  });

  it('does not keep polling once no document is pending', () => {
    service.refresh();
    httpMock.expectOne(documentsUrl).flush({
      documents: [
        {
          id: '1',
          title: 'Doc A',
          content: 'a',
          status: 'ready',
          createdAt: '2026-01-01T00:00:00Z',
        },
      ],
    });

    vi.advanceTimersByTime(10000);
    httpMock.expectNone(documentsUrl);
  });
});
