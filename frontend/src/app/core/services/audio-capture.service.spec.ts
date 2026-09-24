import { TestBed } from '@angular/core/testing';
import { AudioCaptureService, MicrophoneUnavailableError } from './audio-capture.service';

/** A minimal fake MediaRecorder — jsdom (this project's test environment)
 * doesn't implement the real one at all, so every test that needs one
 * stubs this in as the global. */
class FakeMediaRecorder {
  state: 'inactive' | 'recording' = 'inactive';
  mimeType = 'audio/webm';
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onstop: (() => void) | null = null;

  constructor(public readonly stream: MediaStream) {}

  start(): void {
    this.state = 'recording';
  }

  stop(): void {
    this.state = 'inactive';
    this.ondataavailable?.({ data: new Blob(['a chunk of audio']) });
    this.onstop?.();
  }
}

function fakeStream(): MediaStream {
  const stop = vi.fn();
  return { getTracks: () => [{ stop }] } as unknown as MediaStream;
}

/** A minimal fake AnalyserNode whose reported level is controlled directly
 * by the test, rather than actually analyzing anything. */
class FakeAnalyserNode {
  fftSize = 512;
  /** 128 = silence (no deviation from the time-domain midpoint); anything
   * >= 128 + SPEECH_LEVEL_THRESHOLD counts as speech. */
  level = 128;

  getByteTimeDomainData(array: Uint8Array): void {
    array.fill(this.level);
  }
}

/** A minimal fake AudioContext/graph — jsdom has no Web Audio API at all,
 * same "stub the global" pattern as FakeMediaRecorder above. */
class FakeAudioContext {
  readonly analyser = new FakeAnalyserNode();
  closed = false;

  createMediaStreamSource(): { connect: () => void } {
    return { connect: vi.fn() };
  }

  createAnalyser(): FakeAnalyserNode {
    return this.analyser;
  }

  close(): Promise<void> {
    this.closed = true;
    return Promise.resolve();
  }
}

describe('AudioCaptureService', () => {
  let service: AudioCaptureService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(AudioCaptureService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    // getUserMedia is stubbed directly onto navigator.mediaDevices per
    // test (jsdom has no mediaDevices object at all by default), so it
    // needs cleaning up by hand rather than via vi.unstubAllGlobals.
    Reflect.deleteProperty(navigator, 'mediaDevices');
  });

  it('throws MicrophoneUnavailableError when the browser has no MediaRecorder support', async () => {
    // Neither navigator.mediaDevices nor MediaRecorder is stubbed here —
    // exactly jsdom's real, unsupported-by-default state.
    await expect(service.start()).rejects.toBeInstanceOf(MicrophoneUnavailableError);
  });

  it('throws MicrophoneUnavailableError when getUserMedia rejects (permission denied)', async () => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error('denied')) },
    });

    await expect(service.start()).rejects.toBeInstanceOf(MicrophoneUnavailableError);
  });

  it('starts recording when the microphone is granted', async () => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    const stream = fakeStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });

    await expect(service.start()).resolves.toBeUndefined();
  });

  it('stop() resolves with the recorded audio and releases the microphone', async () => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    const stream = fakeStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });

    await service.start();
    const recording = await service.stop();

    expect(recording.blob).toBeInstanceOf(Blob);
    expect(recording.mimeType).toBe('audio/webm');
    expect(stream.getTracks()[0].stop).toHaveBeenCalledTimes(1);
  });

  it('stop() rejects when nothing is currently being recorded', async () => {
    await expect(service.stop()).rejects.toThrow('not currently recording');
  });

  it('cancel() stops an in-progress recording and releases the microphone without error', async () => {
    vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
    const stream = fakeStream();
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });

    await service.start();
    expect(() => service.cancel()).not.toThrow();
    expect(stream.getTracks()[0].stop).toHaveBeenCalledTimes(1);
  });

  it('cancel() is a no-op when nothing is recording', () => {
    expect(() => service.cancel()).not.toThrow();
  });

  describe('silence-based auto-stop (docs/DECISIONS.md ADR-025)', () => {
    let fakeAudioContext: FakeAudioContext;

    beforeEach(() => {
      vi.useFakeTimers();
      vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
      fakeAudioContext = new FakeAudioContext();
      // A plain function that returns the shared fake instance — not
      // `vi.fn()`, which vitest refuses to invoke with `new`.
      vi.stubGlobal('AudioContext', function AudioContextStub() {
        return fakeAudioContext;
      } as unknown as typeof AudioContext);
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream()) },
      });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('fires onAutoStop after real speech followed by enough silence', async () => {
      const onAutoStop = vi.fn();
      await service.start(onAutoStop);

      fakeAudioContext.analyser.level = 200; // speech
      await vi.advanceTimersByTimeAsync(300);
      expect(onAutoStop).not.toHaveBeenCalled();

      fakeAudioContext.analyser.level = 128; // silence
      await vi.advanceTimersByTimeAsync(1400);
      expect(onAutoStop).not.toHaveBeenCalled(); // not quite long enough yet

      await vi.advanceTimersByTimeAsync(200);
      expect(onAutoStop).toHaveBeenCalledTimes(1);
    });

    it('does not fire on silence alone, without any speech first', async () => {
      const onAutoStop = vi.fn();
      await service.start(onAutoStop);

      fakeAudioContext.analyser.level = 128; // silence throughout
      await vi.advanceTimersByTimeAsync(5000);

      expect(onAutoStop).not.toHaveBeenCalled();
    });

    it('fires at most once', async () => {
      const onAutoStop = vi.fn();
      await service.start(onAutoStop);

      fakeAudioContext.analyser.level = 200;
      await vi.advanceTimersByTimeAsync(300);
      fakeAudioContext.analyser.level = 128;
      await vi.advanceTimersByTimeAsync(3000);

      expect(onAutoStop).toHaveBeenCalledTimes(1);
    });

    it('tears down the watcher on stop(), so it cannot fire afterwards', async () => {
      const onAutoStop = vi.fn();
      await service.start(onAutoStop);
      fakeAudioContext.analyser.level = 200;
      await vi.advanceTimersByTimeAsync(300);

      await service.stop();

      expect(fakeAudioContext.closed).toBe(true);
      fakeAudioContext.analyser.level = 128;
      await vi.advanceTimersByTimeAsync(3000);
      expect(onAutoStop).not.toHaveBeenCalled();
    });

    it('tears down the watcher on cancel()', async () => {
      const onAutoStop = vi.fn();
      await service.start(onAutoStop);

      service.cancel();

      expect(fakeAudioContext.closed).toBe(true);
    });

    it('still starts recording normally when AudioContext does not exist at all', async () => {
      vi.unstubAllGlobals();
      vi.stubGlobal('MediaRecorder', FakeMediaRecorder);
      Object.defineProperty(navigator, 'mediaDevices', {
        configurable: true,
        value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream()) },
      });

      const onAutoStop = vi.fn();
      await expect(service.start(onAutoStop)).resolves.toBeUndefined();
      await vi.advanceTimersByTimeAsync(5000);
      expect(onAutoStop).not.toHaveBeenCalled();
    });
  });
});
