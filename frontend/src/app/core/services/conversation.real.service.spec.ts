import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ConversationRealService } from './conversation.real.service';
import { VoiceSessionService } from './voice-session.service';
import { SpeechService } from './speech.service';
import { AudioPlaybackService } from './audio-playback.service';
import { environment } from '../../../environments/environment';
import type { VoiceState } from '../models/voice-state.model';

describe('ConversationRealService', () => {
  const voiceState = signal<VoiceState>('idle');
  let httpMock: HttpTestingController;
  let service: ConversationRealService;
  let speechFake: { transcribe: ReturnType<typeof vi.fn>; synthesize: ReturnType<typeof vi.fn> };
  let audioPlaybackFake: { play: ReturnType<typeof vi.fn>; stop: ReturnType<typeof vi.fn> };

  const historyUrl = `${environment.apiBaseUrl}/v1/chat/history`;
  const chatUrl = `${environment.apiBaseUrl}/v1/chat`;

  beforeEach(() => {
    vi.useFakeTimers();
    voiceState.set('idle');
    speechFake = {
      transcribe: vi.fn(),
      synthesize: vi.fn().mockResolvedValue(new Blob(['fake audio'])),
    };
    audioPlaybackFake = { play: vi.fn().mockResolvedValue(undefined), stop: vi.fn() };

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: VoiceSessionService,
          useValue: { state: voiceState, setState: (s: VoiceState) => voiceState.set(s) },
        },
        { provide: SpeechService, useValue: speechFake },
        { provide: AudioPlaybackService, useValue: audioPlaybackFake },
      ],
    });

    httpMock = TestBed.inject(HttpTestingController);
    service = TestBed.inject(ConversationRealService);
    // Every test starts by satisfying the constructor's history fetch.
    httpMock.expectOne(historyUrl).flush({ turns: [] });
  });

  afterEach(() => {
    httpMock.verify();
    vi.useRealTimers();
  });

  it('loads history on construction', () => {
    // Re-created fresh, so it can assert on the very first request itself.
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: VoiceSessionService,
          useValue: { state: voiceState, setState: (s: VoiceState) => voiceState.set(s) },
        },
      ],
    });
    const freshMock = TestBed.inject(HttpTestingController);
    const freshService = TestBed.inject(ConversationRealService);

    const req = freshMock.expectOne(historyUrl);
    expect(req.request.method).toBe('GET');
    req.flush({
      turns: [
        { id: 't1', role: 'user', text: 'hi', language: 'en', createdAt: '2026-01-01T00:00:00Z' },
      ],
    });

    expect(freshService.turns()).toHaveLength(1);
    expect(freshService.turns()[0].text).toBe('hi');
    freshMock.verify();
  });

  it('sets the error state if loading history fails', () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: VoiceSessionService,
          useValue: { state: voiceState, setState: (s: VoiceState) => voiceState.set(s) },
        },
      ],
    });
    const freshMock = TestBed.inject(HttpTestingController);
    TestBed.inject(ConversationRealService);

    freshMock
      .expectOne(historyUrl)
      .flush('boom', { status: 500, statusText: 'Internal Server Error' });

    expect(voiceState()).toBe('error');
    freshMock.verify();
  });

  it('ignores empty or whitespace-only input', () => {
    service.sendUserTurn('   ', 'en');
    expect(service.turns()).toHaveLength(0);
    httpMock.expectNone(chatUrl);
  });

  it('appends the user turn immediately and moves to processing', () => {
    service.sendUserTurn('Hello', 'en');

    expect(service.turns()).toHaveLength(1);
    expect(service.turns()[0]).toMatchObject({ role: 'user', text: 'Hello', language: 'en' });
    expect(voiceState()).toBe('processing');

    httpMock.expectOne(chatUrl).flush({
      userTurn: {
        id: 'u1',
        role: 'user',
        text: 'Hello',
        language: 'en',
        createdAt: '2026-01-01T00:00:00Z',
      },
      assistantTurn: {
        id: 'a1',
        role: 'assistant',
        text: 'Hi there',
        language: 'en',
        createdAt: '2026-01-01T00:00:01Z',
        latencyMs: 42,
      },
    });
  });

  it('sends the correct request body to the real backend contract', () => {
    service.sendUserTurn('आज मौसम कैसा है?', 'hi');

    const req = httpMock.expectOne(chatUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ text: 'आज मौसम कैसा है?', language: 'hi' });
    req.flush({
      userTurn: {
        id: 'u1',
        role: 'user',
        text: 'आज मौसम कैसा है?',
        language: 'hi',
        createdAt: '2026-01-01T00:00:00Z',
      },
      assistantTurn: {
        id: 'a1',
        role: 'assistant',
        text: 'reply',
        language: 'hi',
        createdAt: '2026-01-01T00:00:00Z',
      },
    });
  });

  it('appends the assistant reply, goes responding then idle, on success', () => {
    service.sendUserTurn('Hello', 'en');
    httpMock.expectOne(chatUrl).flush({
      userTurn: {
        id: 'u1',
        role: 'user',
        text: 'Hello',
        language: 'en',
        createdAt: '2026-01-01T00:00:00Z',
      },
      assistantTurn: {
        id: 'a1',
        role: 'assistant',
        text: 'Hi',
        language: 'en',
        createdAt: '2026-01-01T00:00:00Z',
        latencyMs: 5,
      },
    });

    expect(service.turns()).toHaveLength(2);
    expect(service.turns()[1]).toMatchObject({ role: 'assistant', text: 'Hi', latencyMs: 5 });
    expect(voiceState()).toBe('responding');

    vi.advanceTimersByTime(700);
    expect(voiceState()).toBe('idle');
  });

  it('synthesizes and plays the assistant reply on success', async () => {
    service.sendUserTurn('Hello', 'en');
    httpMock.expectOne(chatUrl).flush({
      userTurn: {
        id: 'u1',
        role: 'user',
        text: 'Hello',
        language: 'en',
        createdAt: '2026-01-01T00:00:00Z',
      },
      assistantTurn: {
        id: 'a1',
        role: 'assistant',
        text: 'Hi there',
        language: 'en',
        createdAt: '2026-01-01T00:00:00Z',
      },
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(speechFake.synthesize).toHaveBeenCalledWith('Hi there', 'en');
    expect(audioPlaybackFake.play).toHaveBeenCalledTimes(1);
  });

  it('a synthesis failure is logged but does not affect the conversation state', async () => {
    speechFake.synthesize.mockRejectedValueOnce(new Error('tts_unavailable'));
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    service.sendUserTurn('Hello', 'en');
    httpMock.expectOne(chatUrl).flush({
      userTurn: {
        id: 'u1',
        role: 'user',
        text: 'Hello',
        language: 'en',
        createdAt: '2026-01-01T00:00:00Z',
      },
      assistantTurn: {
        id: 'a1',
        role: 'assistant',
        text: 'Hi there',
        language: 'en',
        createdAt: '2026-01-01T00:00:00Z',
      },
    });

    await Promise.resolve();
    await Promise.resolve();

    expect(voiceState()).toBe('responding');
    expect(service.turns()).toHaveLength(2);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it('sets the error state on an HTTP failure and does not add a reply', () => {
    service.sendUserTurn('Hello', 'en');
    httpMock.expectOne(chatUrl).flush('down', { status: 502, statusText: 'Bad Gateway' });

    expect(voiceState()).toBe('error');
    expect(service.turns().filter((t) => t.role === 'assistant')).toHaveLength(0);
  });

  it('cancels the first request outright when a newer turn starts before it resolves', () => {
    service.sendUserTurn('First', 'en');
    const firstReq = httpMock.expectOne(chatUrl);

    service.sendUserTurn('Second', 'en'); // supersedes the first before it resolves
    const secondReq = httpMock.expectOne(chatUrl);

    // Real cancellation, not just a flag: Angular's HTTP testing backend
    // refuses to flush a request whose subscription was unsubscribed.
    expect(firstReq.cancelled).toBe(true);

    secondReq.flush({
      userTurn: {
        id: 'u2',
        role: 'user',
        text: 'Second',
        language: 'en',
        createdAt: '2026-01-01T00:00:00Z',
      },
      assistantTurn: {
        id: 'a2',
        role: 'assistant',
        text: 'fresh reply',
        language: 'en',
        createdAt: '2026-01-01T00:00:00Z',
      },
    });

    const assistantTexts = service
      .turns()
      .filter((t) => t.role === 'assistant')
      .map((t) => t.text);
    expect(assistantTexts).toEqual(['fresh reply']);
  });

  it('simulateError sets the error state', () => {
    service.simulateError();
    expect(voiceState()).toBe('error');
  });
});
