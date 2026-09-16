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

  /** Requests the microphone and starts recording. Rejects with
   * [MicrophoneUnavailableError] if permission is denied, no microphone
   * exists, or the browser doesn't support the required APIs. */
  async start(): Promise<void> {
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
