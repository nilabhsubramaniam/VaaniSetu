import { TestBed } from '@angular/core/testing';
import { MicButton } from './mic-button';
import { ConversationService } from '../../core/services/conversation.service';
import { VoiceSessionMockService } from '../../core/services/voice-session.mock.service';
import { VoiceSessionService } from '../../core/services/voice-session.service';

describe('MicButton', () => {
  let sendUserTurn: ReturnType<typeof vi.fn>;
  let voiceSession: VoiceSessionMockService;

  beforeEach(() => {
    vi.useFakeTimers();
    sendUserTurn = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        { provide: VoiceSessionService, useClass: VoiceSessionMockService },
        { provide: ConversationService, useValue: { sendUserTurn, simulateError: vi.fn() } },
      ],
    });

    voiceSession = TestBed.inject(VoiceSessionService) as VoiceSessionMockService;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts listening on press from idle', () => {
    const fixture = TestBed.createComponent(MicButton);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();

    expect(voiceSession.state()).toBe('listening');
  });

  it('auto-stops after the mock listening window and sends a turn', () => {
    const fixture = TestBed.createComponent(MicButton);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();

    vi.advanceTimersByTime(1500);

    expect(sendUserTurn).toHaveBeenCalledTimes(1);
    expect(sendUserTurn.mock.calls[0][1]).toBe('hi'); // SettingsStore default language
  });

  it('stops early and sends immediately on a second press while listening', () => {
    const fixture = TestBed.createComponent(MicButton);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;

    button.click(); // start listening
    button.click(); // stop early

    expect(sendUserTurn).toHaveBeenCalledTimes(1);
  });

  it('is disabled while processing or responding', () => {
    const fixture = TestBed.createComponent(MicButton);
    voiceSession.setState('processing');
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(button.hasAttribute('disabled')).toBe(true);
  });

  it('is available again once an error state is reached', () => {
    const fixture = TestBed.createComponent(MicButton);
    voiceSession.setState('error');
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(button.getAttribute('aria-label')).toBe('Try again');
  });
});
