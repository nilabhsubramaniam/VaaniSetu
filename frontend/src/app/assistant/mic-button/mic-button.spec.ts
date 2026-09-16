import { TestBed } from '@angular/core/testing';
import { MicButton } from './mic-button';
import { ConversationService } from '../../core/services/conversation.service';
import { VoiceSessionMockService } from '../../core/services/voice-session.mock.service';
import { VoiceSessionService } from '../../core/services/voice-session.service';
import {
  AudioCaptureService,
  MicrophoneUnavailableError,
} from '../../core/services/audio-capture.service';
import { SpeechService } from '../../core/services/speech.service';

/** Drains the microtask queue so chained `await`s inside the component
 * (start recording -> stop -> transcribe -> send) settle before an
 * assertion, without touching fake timers (those only affect real
 * `setTimeout`/`setInterval`, not Promise resolution). */
async function flushMicrotasks(): Promise<void> {
  for (let i = 0; i < 5; i++) {
    await Promise.resolve();
  }
}

describe('MicButton', () => {
  let sendUserTurn: ReturnType<typeof vi.fn>;
  let voiceSession: VoiceSessionMockService;
  let audioStart: ReturnType<typeof vi.fn>;
  let audioStop: ReturnType<typeof vi.fn>;
  let audioCancel: ReturnType<typeof vi.fn>;
  let transcribe: ReturnType<typeof vi.fn>;

  const fakeRecording = { blob: new Blob(['audio']), mimeType: 'audio/webm' };

  beforeEach(() => {
    vi.useFakeTimers();
    sendUserTurn = vi.fn();
    audioStart = vi.fn().mockResolvedValue(undefined);
    audioStop = vi.fn().mockResolvedValue(fakeRecording);
    audioCancel = vi.fn();
    transcribe = vi.fn().mockResolvedValue('आज मौसम कैसा है?');

    TestBed.configureTestingModule({
      providers: [
        { provide: VoiceSessionService, useClass: VoiceSessionMockService },
        { provide: ConversationService, useValue: { sendUserTurn, simulateError: vi.fn() } },
        {
          provide: AudioCaptureService,
          useValue: { start: audioStart, stop: audioStop, cancel: audioCancel },
        },
        { provide: SpeechService, useValue: { transcribe } },
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

  it('on a second press, stops recording, transcribes, and sends the real transcript', async () => {
    const fixture = TestBed.createComponent(MicButton);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;

    button.click(); // start
    await flushMicrotasks();
    button.click(); // stop early
    await flushMicrotasks();

    expect(audioStop).toHaveBeenCalledTimes(1);
    expect(transcribe).toHaveBeenCalledWith(fakeRecording.blob, 'hi'); // SettingsStore default language
    expect(sendUserTurn).toHaveBeenCalledTimes(1);
    expect(sendUserTurn).toHaveBeenCalledWith('आज मौसम कैसा है?', 'hi');
  });

  it('auto-stops and sends after the max-duration safety timeout', async () => {
    const fixture = TestBed.createComponent(MicButton);
    fixture.detectChanges();
    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();
    await flushMicrotasks();

    vi.advanceTimersByTime(30_000);
    await flushMicrotasks();

    expect(sendUserTurn).toHaveBeenCalledTimes(1);
  });

  it('goes to the error state if starting the recording fails', async () => {
    audioStart.mockRejectedValue(new MicrophoneUnavailableError('denied'));
    const fixture = TestBed.createComponent(MicButton);
    fixture.detectChanges();

    (fixture.nativeElement as HTMLElement).querySelector('button')!.click();
    await flushMicrotasks();

    expect(voiceSession.state()).toBe('error');
    expect(sendUserTurn).not.toHaveBeenCalled();
  });

  it('goes to the error state if transcription fails, without sending a turn', async () => {
    transcribe.mockRejectedValue(new Error('network error'));
    const fixture = TestBed.createComponent(MicButton);
    fixture.detectChanges();
    const button = (fixture.nativeElement as HTMLElement).querySelector('button')!;

    button.click();
    await flushMicrotasks();
    button.click();
    await flushMicrotasks();

    expect(voiceSession.state()).toBe('error');
    expect(sendUserTurn).not.toHaveBeenCalled();
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
