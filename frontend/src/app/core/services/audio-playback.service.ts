import { Injectable } from '@angular/core';

/**
 * Thin wrapper around the browser's `<audio>` element — the one place in
 * this codebase that touches audio playback (docs/ARCHITECTURE.md §3.1,
 * "play synthesized audio in the browser"), mirroring `AudioCaptureService`'s
 * role on the capture side.
 *
 * Not behind an abstract-class + DI-token interface like
 * `ConversationService`: there is exactly one real implementation and no
 * second one is anticipated (AGENTS.md §6, "no speculative abstraction").
 */
@Injectable({ providedIn: 'root' })
export class AudioPlaybackService {
  private audio?: HTMLAudioElement;
  private objectUrl?: string;

  /**
   * Plays audio, replacing (and discarding) any currently playing clip.
   * Resolves when playback finishes; rejects if the browser refuses to
   * play it (e.g. an unsupported format).
   */
  play(blob: Blob): Promise<void> {
    this.stop();

    const url = URL.createObjectURL(blob);
    this.objectUrl = url;
    const audio = new Audio(url);
    this.audio = audio;

    return new Promise((resolve, reject) => {
      audio.onended = () => {
        this.releaseIfCurrent(audio);
        resolve();
      };
      audio.onerror = () => {
        this.releaseIfCurrent(audio);
        reject(new Error('audio playback failed'));
      };
      audio.play().catch((err: unknown) => {
        this.releaseIfCurrent(audio);
        reject(err instanceof Error ? err : new Error('audio playback failed'));
      });
    });
  }

  /** Stops any currently playing clip and releases its resources. A no-op
   * if nothing is playing. */
  stop(): void {
    this.audio?.pause();
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
    }
    this.audio = undefined;
    this.objectUrl = undefined;
  }

  private releaseIfCurrent(audio: HTMLAudioElement): void {
    if (this.audio !== audio) return; // superseded by a newer play() call
    if (this.objectUrl) {
      URL.revokeObjectURL(this.objectUrl);
    }
    this.audio = undefined;
    this.objectUrl = undefined;
  }
}
