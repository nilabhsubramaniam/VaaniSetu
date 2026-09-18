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
});
