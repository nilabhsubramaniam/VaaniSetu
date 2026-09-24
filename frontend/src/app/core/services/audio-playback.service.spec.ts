import { TestBed } from '@angular/core/testing';
import { AudioPlaybackService } from './audio-playback.service';

/** A minimal fake `Audio` — jsdom (this project's test environment) has no
 * real media playback, so every test that needs one stubs this in as the
 * global, mirroring AudioCaptureService's FakeMediaRecorder pattern. */
class FakeAudio {
  static instances: FakeAudio[] = [];

  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readonly play = vi.fn<() => Promise<void>>().mockResolvedValue(undefined);
  readonly pause = vi.fn();

  constructor(public readonly src: string) {
    FakeAudio.instances.push(this);
  }
}

describe('AudioPlaybackService', () => {
  let service: AudioPlaybackService;

  beforeEach(() => {
    FakeAudio.instances = [];
    vi.stubGlobal('Audio', FakeAudio);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:fake-url'),
      revokeObjectURL: vi.fn(),
    });

    TestBed.configureTestingModule({});
    service = TestBed.inject(AudioPlaybackService);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('plays the given blob and resolves when playback ends', async () => {
    const playPromise = service.play(new Blob(['audio']));

    expect(FakeAudio.instances).toHaveLength(1);
    expect(FakeAudio.instances[0].play).toHaveBeenCalledTimes(1);

    FakeAudio.instances[0].onended?.();
    await expect(playPromise).resolves.toBeUndefined();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });

  it('rejects when the browser reports a playback error', async () => {
    const playPromise = service.play(new Blob(['audio']));

    FakeAudio.instances[0].onerror?.();

    await expect(playPromise).rejects.toThrow('audio playback failed');
  });

  it('rejects when audio.play() itself rejects (e.g. unsupported format)', async () => {
    class FailingAudio extends FakeAudio {
      override readonly play = vi
        .fn<() => Promise<void>>()
        .mockRejectedValue(new Error('NotSupportedError'));
    }
    vi.stubGlobal('Audio', FailingAudio);

    await expect(service.play(new Blob(['audio']))).rejects.toThrow('NotSupportedError');
  });

  it('stop() pauses and releases a currently playing clip', () => {
    void service.play(new Blob(['audio']));
    const audio = FakeAudio.instances[0];

    service.stop();

    expect(audio.pause).toHaveBeenCalledTimes(1);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:fake-url');
  });

  it('stop() is a no-op when nothing is playing', () => {
    expect(() => service.stop()).not.toThrow();
  });

  it('starting a new play() supersedes and stops the previous clip', () => {
    void service.play(new Blob(['first']));
    const first = FakeAudio.instances[0];

    void service.play(new Blob(['second']));

    expect(first.pause).toHaveBeenCalledTimes(1);
    expect(FakeAudio.instances).toHaveLength(2);
  });
});
