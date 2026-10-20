import { TestBed } from '@angular/core/testing';
import { DocumentMockService } from './document.mock.service';

describe('DocumentMockService', () => {
  let service: DocumentMockService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({});
    service = TestBed.inject(DocumentMockService);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with no documents', () => {
    expect(service.documents()).toEqual([]);
  });

  it('ignores an upload with an empty title or content', () => {
    service.upload('  ', 'some content');
    service.upload('a title', '   ');
    expect(service.documents()).toEqual([]);
  });

  it('adds the document immediately at "pending"', () => {
    service.upload('My Doc', 'Some content');

    expect(service.documents()).toHaveLength(1);
    expect(service.documents()[0]).toMatchObject({
      title: 'My Doc',
      content: 'Some content',
      status: 'pending',
    });
  });

  it('flips the document to "ready" after the simulated processing delay', () => {
    service.upload('My Doc', 'Some content');

    vi.advanceTimersByTime(1500);

    expect(service.documents()[0].status).toBe('ready');
  });

  it('prepends new uploads, most recent first', () => {
    service.upload('First', 'content one');
    service.upload('Second', 'content two');

    expect(service.documents().map((d) => d.title)).toEqual(['Second', 'First']);
  });
});
