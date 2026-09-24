import { Injectable } from '@angular/core';

/**
 * Thrown when the browser denies microphone access, has none, or doesn't
 * support the APIs this service needs — distinct from a transcription
 * failure (see `SpeechService`), so callers can tell "never got audio"
 * apart from "got audio, the server rejected it" if they ever want to.
 * Both currently map to the same `error` voice state (docs/DECISIONS.md
 * ADR-017), so today the distinction is informational only.
 */
export class MicrophoneUnavailableError extends Error {}

/** How often the silence watcher samples the live audio level. Chosen
 * small enough to feel responsive, large enough to drive deterministically
 * in tests with fake timers (docs/DECISIONS.md ADR-025). */
const SILENCE_CHECK_INTERVAL_MS = 100;
/** How long the level must stay below SPEECH_LEVEL_THRESHOLD, after real
 * speech has been heard, before auto-stopping. Tunable — revisit if real
 * usage shows it cutting people off or waiting too long. */
const SILENCE_DURATION_MS = 1500;
/** Guards against auto-stopping instantly before the user has said
 * anything at all (e.g. a moment of dead air right after pressing the
 * button). */
const MIN_SPEECH_MS_BEFORE_AUTO_STOP = 300;
/** Mean absolute deviation from the time-domain midpoint (128) counted as
 * "someone is speaking" — a coarse volume proxy, not real VAD (ADR-025:
 * a full VAD model is Phase 11's scope, not this heuristic's). */
const SPEECH_LEVEL_THRESHOLD = 8;

/** What one completed recording produced. */
export interface Recording {
  readonly blob: Blob;
  readonly mimeType: string;
}

/**
 * Thin wrapper around the browser's `MediaRecorder` API — the one place in
 * this codebase that touches raw audio capture (docs/ARCHITECTURE.md §3.1,
 * "capture microphone audio ... in the browser").
 *
 * Not behind an abstract-class + DI-token interface like
 * `ConversationService`: there is exactly one real implementation and no
 * second one is anticipated (AGENTS.md §6, "no speculative abstraction").
 * Phase 3 Milestone 3a's "fake" lives entirely on the backend
 * (`asr.FakeASRClient`), invisible to this class — real audio is always
 * actually captured and uploaded, even though nothing real transcribes it
 * yet.
 */
@Injectable({ providedIn: 'root' })
export class AudioCaptureService {
  private mediaRecorder?: MediaRecorder;
  private chunks: Blob[] = [];
  private stream?: MediaStream;
  private mimeType = 'audio/webm';

  private audioContext?: AudioContext;
  private silenceCheckHandle?: ReturnType<typeof setInterval>;

  /** Requests the microphone and starts recording. Rejects with
   * [MicrophoneUnavailableError] if permission is denied, no microphone
   * exists, or the browser doesn't support the required APIs.
   *
   * `onAutoStop`, if given, is called at most once when the recording has
   * had real speech followed by a period of silence (docs/DECISIONS.md
   * ADR-025) — a coarse client-side heuristic, not a VAD model
   * (docs/ROADMAP.md Phase 11 owns that). Feature-detected: if this
   * browser has no usable Web Audio API, the callback is simply never
   * invoked — recording still proceeds normally via `MediaRecorder`, and
   * manual tap-to-stop remains the fallback. */
  async start(onAutoStop?: () => void): Promise<void> {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      throw new MicrophoneUnavailableError('audio capture is not supported in this browser');
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      throw new MicrophoneUnavailableError('microphone permission was denied or unavailable');
    }

    this.stream = stream;
    this.chunks = [];
    this.mediaRecorder = new MediaRecorder(stream);
    this.mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data.size > 0) {
        this.chunks.push(event.data);
      }
    };
    this.mimeType = this.mediaRecorder.mimeType || this.mimeType;
    this.mediaRecorder.start();

    if (onAutoStop) {
      this.startSilenceWatcher(stream, onAutoStop);
    }
  }

  /** Sets up the Web Audio analysis graph and polling tick described in
   * `start`'s doc comment. Never throws — any setup failure (including
   * `AudioContext` not existing at all) just means no auto-stop, silently. */
  private startSilenceWatcher(stream: MediaStream, onAutoStop: () => void): void {
    const AudioContextCtor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) {
      return;
    }

    try {
      const audioContext = new AudioContextCtor();
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      this.audioContext = audioContext;

      const data = new Uint8Array(analyser.fftSize);
      let speechMs = 0;
      let silenceMs = 0;

      this.silenceCheckHandle = setInterval(() => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (const value of data) {
          sum += Math.abs(value - 128);
        }
        const level = sum / data.length;

        if (level >= SPEECH_LEVEL_THRESHOLD) {
          speechMs += SILENCE_CHECK_INTERVAL_MS;
          silenceMs = 0;
        } else {
          silenceMs += SILENCE_CHECK_INTERVAL_MS;
        }

        if (speechMs >= MIN_SPEECH_MS_BEFORE_AUTO_STOP && silenceMs >= SILENCE_DURATION_MS) {
          this.stopSilenceWatcher();
          onAutoStop();
        }
      }, SILENCE_CHECK_INTERVAL_MS);
    } catch (err) {
      console.error('silence watcher setup failed, falling back to manual stop only', err);
      this.stopSilenceWatcher();
    }
  }

  private stopSilenceWatcher(): void {
    if (this.silenceCheckHandle !== undefined) {
      clearInterval(this.silenceCheckHandle);
      this.silenceCheckHandle = undefined;
    }
    if (this.audioContext) {
      void this.audioContext.close();
      this.audioContext = undefined;
    }
  }

  /** Stops recording and releases the microphone, resolving with the
   * captured audio. Rejects if nothing is currently being recorded. */
  stop(): Promise<Recording> {
    return new Promise((resolve, reject) => {
      const recorder = this.mediaRecorder;
      if (!recorder || recorder.state === 'inactive') {
        reject(new Error('not currently recording'));
        return;
      }

      this.stopSilenceWatcher();
      recorder.onstop = () => {
        const blob = new Blob(this.chunks, { type: this.mimeType });
        this.releaseStream();
        resolve({ blob, mimeType: this.mimeType });
      };
      recorder.stop();
    });
  }

  /** Stops recording (discarding any audio) and releases the microphone —
   * used when a turn is abandoned or a component is destroyed mid-recording. */
  cancel(): void {
    this.stopSilenceWatcher();
    if (this.mediaRecorder && this.mediaRecorder.state !== 'inactive') {
      this.mediaRecorder.stop();
    }
    this.releaseStream();
  }

  private releaseStream(): void {
    this.stream?.getTracks().forEach((track) => track.stop());
    this.stream = undefined;
  }
}
