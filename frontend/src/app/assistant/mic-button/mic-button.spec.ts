import { TestBed } from '@angular/core/testing';
import { MicButton } from './mic-button';
import { ConversationService } from '../../core/services/conversation.service';
import { VoiceSessionMockService } from '../../core/services/voice-session.mock.service';
import { VoiceSessionService } from '../../core/services/voice-session.service';
import {
  AudioCaptureService,
  MicrophoneUnavailableError,
} from '../../core/services/audio-capture.service';

/** Drains the microtask queue so chained `await`s inside the component
 * (start recording -> stop -> send) settle before an assertion, without
 * touching fake timers (those only affect real
 * `setTimeout`/`setInterval`, not Promise resolution). */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe('MicButton', () => {
  let sendVoiceTurn: ReturnType<typeof vi.fn>;
  let voiceSession: VoiceSessionMockService;
  let audioStart: ReturnType<typeof vi.fn>;
  let audioStop: ReturnType<typeof vi.fn>;
  let audioCancel: ReturnType<typeof vi.fn>;

  const fakeRecording = { blob: new Blob(['audio']), mimeType: 'audio/webm' };

  beforeEach(() => {
    vi.useFakeTimers();
    sendVoiceTurn = vi.fn();
    audioStart = vi.fn().mockResolvedValue(undefined);
    audioStop = vi.fn().mockResolvedValue(fakeRecording);
    audioCancel = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        { provide: VoiceSessionService, useClass: VoiceSessionMockService },
        { provide: ConversationService, useValue: { sendVoiceTurn, simulateError: vi.fn() } },
        {
          provide: AudioCaptureService,
          useValue: { start: audioStart, stop: audioStop, cancel: audioCancel },
        },
      ],
    });

    voiceSession = TestBed.inject(VoiceSessionService) as VoiceSessionMockService;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts listening on press from idle and requests the microphone', async () => {
    const fixture = TestBed.createComponent(MicButton);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();
    expect(voiceSession.state()).toBe('listening');

    await flushMicrotasks();
    expect(audioStart).toHaveBeenCalledTimes(1);
  });

  it('on a second press, stops recording and sends one orchestrated voice turn', async () => {
    const fixture = TestBed.createComponent(MicButton);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;

    button.click(); // start
    await flushMicrotasks();
    button.click(); // stop early
    await flushMicrotasks();

    expect(audioStop).toHaveBeenCalledTimes(1);
    // SettingsStore defaults: language 'hi', voice 'female'. Transcription,
    // reply generation, and synthesis all happen server-side now
    // (docs/DECISIONS.md ADR-024) — this component makes exactly one call.
    expect(sendVoiceTurn).toHaveBeenCalledTimes(1);
    expect(sendVoiceTurn).toHaveBeenCalledWith(fakeRecording.blob, 'hi', 'female');
  });

  it('auto-stops and sends after the max-duration safety timeout', async () => {
    const fixture = TestBed.createComponent(MicButton);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();
    await flushMicrotasks();

    vi.advanceTimersByTime(30_000);
    await flushMicrotasks();

    expect(sendVoiceTurn).toHaveBeenCalledTimes(1);
  });

  it('goes to the error state if starting the recording fails', async () => {
    audioStart.mockRejectedValue(new MicrophoneUnavailableError('denied'));
    const fixture = TestBed.createComponent(MicButton);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();
    await flushMicrotasks();

    expect(voiceSession.state()).toBe('error');
    expect(sendVoiceTurn).not.toHaveBeenCalled();
  });

  it('goes to the error state if stopping the recording fails, without sending a turn', async () => {
    audioStop.mockRejectedValue(new Error('recorder error'));
    const fixture = TestBed.createComponent(MicButton);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;

    button.click();
    await flushMicrotasks();
    button.click();
    await flushMicrotasks();

    expect(voiceSession.state()).toBe('error');
    expect(sendVoiceTurn).not.toHaveBeenCalled();
  });

  it('cancels an in-progress recording when the component is destroyed', () => {
    const fixture = TestBed.createComponent(MicButton);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();

    fixture.destroy();

    expect(audioCancel).toHaveBeenCalledTimes(1);
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
