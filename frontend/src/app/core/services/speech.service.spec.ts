import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { SpeechService } from './speech.service';
import { environment } from '../../../environments/environment';

describe('SpeechService', () => {
  let httpMock: HttpTestingController;
  let service: SpeechService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(SpeechService);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('posts the audio blob to the transcribe endpoint with the language as a query param', async () => {
    const audio = new Blob(['fake audio'], { type: 'audio/webm' });

    const resultPromise = service.transcribe(audio, 'hi');

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/v1/speech/transcribe?language=hi`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toBe(audio);
    expect(req.request.headers.get('Content-Type')).toBe('audio/webm');
    req.flush({ transcript: 'आज मौसम कैसा है?' });

    await expect(resultPromise).resolves.toBe('आज मौसम कैसा है?');
  });

  it('falls back to application/octet-stream when the blob has no type', async () => {
    const audio = new Blob(['fake audio']); // no explicit type

    void service.transcribe(audio, 'en');

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/v1/speech/transcribe?language=en`);
    expect(req.request.headers.get('Content-Type')).toBe('application/octet-stream');
    req.flush({ transcript: 'ok' });
  });

  it('rejects when the backend returns an error', async () => {
    const audio = new Blob(['fake audio'], { type: 'audio/webm' });

    const resultPromise = service.transcribe(audio, 'en');

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/v1/speech/transcribe?language=en`);
    req.flush('boom', { status: 502, statusText: 'Bad Gateway' });

    await expect(resultPromise).rejects.toBeTruthy();
  });

  it('posts text and language as JSON to the synthesize endpoint and resolves with the audio blob', async () => {
    const resultPromise = service.synthesize('आज मौसम अच्छा है', 'hi');

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/v1/speech/synthesize`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ text: 'आज मौसम अच्छा है', language: 'hi' });
    expect(req.request.responseType).toBe('blob');

    const audioBlob = new Blob(['fake wav bytes'], { type: 'audio/wav' });
    req.flush(audioBlob);

    await expect(resultPromise).resolves.toBe(audioBlob);
  });

  it('synthesize() rejects when the backend returns an error', async () => {
    const resultPromise = service.synthesize('hello', 'en');

    const req = httpMock.expectOne(`${environment.apiBaseUrl}/v1/speech/synthesize`);
    // A blob-responseType request needs a Blob body on error too — a plain
    // string trips Angular's test-harness auto-conversion to Blob.
    req.flush(new Blob(['boom']), { status: 502, statusText: 'Bad Gateway' });

    await expect(resultPromise).rejects.toBeTruthy();
  });
});
