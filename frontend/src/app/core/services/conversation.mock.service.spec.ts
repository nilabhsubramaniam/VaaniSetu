import { TestBed } from '@angular/core/testing';
import { ConversationMockService } from './conversation.mock.service';
import { VoiceSessionMockService } from './voice-session.mock.service';
import { VoiceSessionService } from './voice-session.service';

describe('ConversationMockService', () => {
  let service: ConversationMockService;
  let voiceSession: VoiceSessionMockService;

  beforeEach(() => {
    vi.useFakeTimers();
    TestBed.configureTestingModule({
      providers: [{ provide: VoiceSessionService, useClass: VoiceSessionMockService }],
    });
    service = TestBed.inject(ConversationMockService);
    voiceSession = TestBed.inject(VoiceSessionService) as VoiceSessionMockService;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts with no turns', () => {
    expect(service.turns()).toEqual([]);
  });

  it('ignores an empty or whitespace-only message', () => {
    service.sendUserTurn('   ', 'en');
    expect(service.turns()).toEqual([]);
  });

  it('records the user turn immediately and moves to processing', () => {
    service.sendUserTurn('Hello', 'en');

    expect(service.turns()).toHaveLength(1);
    expect(service.turns()[0]).toMatchObject({ role: 'user', text: 'Hello', language: 'en' });
    expect(voiceSession.state()).toBe('processing');
  });

  it('adds a canned assistant reply after the mock delay, then goes idle', () => {
    service.sendUserTurn('Hello', 'hi');

    vi.advanceTimersByTime(900);
    expect(service.turns()).toHaveLength(2);
    expect(service.turns()[1].role).toBe('assistant');
    expect(service.turns()[1].language).toBe('hi');
    expect(voiceSession.state()).toBe('responding');

    vi.advanceTimersByTime(700);
    expect(voiceSession.state()).toBe('idle');
  });

  it('does not apply a stale reply if a newer turn has started', () => {
    service.sendUserTurn('First', 'en');
    vi.advanceTimersByTime(300);
    service.sendUserTurn('Second', 'en'); // supersedes the first cycle

    vi.advanceTimersByTime(900);
    // Exactly one assistant reply should exist (for "Second"), not two.
    const assistantTurns = service.turns().filter((t) => t.role === 'assistant');
    expect(assistantTurns).toHaveLength(1);
  });

  it('simulateError cancels an in-flight reply and sets the error state', () => {
    service.sendUserTurn('Hello', 'en');
    service.simulateError();

    expect(voiceSession.state()).toBe('error');

    vi.advanceTimersByTime(2000);
    // The cancelled cycle must not overwrite the error state or add a reply.
    expect(voiceSession.state()).toBe('error');
    expect(service.turns().filter((t) => t.role === 'assistant')).toHaveLength(0);
  });
});
