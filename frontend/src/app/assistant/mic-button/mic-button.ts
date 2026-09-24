import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { ConversationService } from '../../core/services/conversation.service';
import { SettingsStore } from '../../core/services/settings.store';
import { VoiceSessionService } from '../../core/services/voice-session.service';
import { AudioCaptureService } from '../../core/services/audio-capture.service';

/** Safety cap so a forgotten open mic doesn't record forever. Real
 * endpointing is manual (tap again to stop) — see docs/DECISIONS.md
 * ADR-017 for why Phase 3 doesn't add an automatic VAD model. */
const MAX_RECORDING_MS = 30_000;

@Component({
  selector: 'app-mic-button',
  templateUrl: './mic-button.html',
  styleUrl: './mic-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MicButton {
  private readonly voiceSession = inject(VoiceSessionService);
  private readonly conversation = inject(ConversationService);
  private readonly settings = inject(SettingsStore);
  private readonly audioCapture = inject(AudioCaptureService);
  private readonly destroyRef = inject(DestroyRef);

  private maxDurationHandle: ReturnType<typeof setTimeout> | undefined;

  readonly state = this.voiceSession.state;
  readonly isListening = computed(() => this.state() === 'listening');
  readonly isBusy = computed(() => this.state() === 'processing' || this.state() === 'responding');

  constructor() {
    this.destroyRef.onDestroy(() => this.cancelRecording());
  }

  onPress(): void {
    if (this.isBusy()) {
      return; // a reply is already in flight; wait for it to finish
    }

    if (this.isListening()) {
      void this.stopListeningAndSend();
      return;
    }

    void this.startListening();
  }

  private async startListening(): Promise<void> {
    // Set optimistically, before the (async) permission prompt resolves,
    // so a rapid second press is read by onPress as "stop", not "start
    // again" — JS's single-threaded execution makes this race-free.
    this.voiceSession.setState('listening');

    try {
      await this.audioCapture.start();
    } catch (err) {
      console.error('failed to start recording', err);
      this.voiceSession.setState('error');
      return;
    }

    this.maxDurationHandle = setTimeout(() => void this.stopListeningAndSend(), MAX_RECORDING_MS);
  }

  private async stopListeningAndSend(): Promise<void> {
    this.clearMaxDuration();
    if (this.state() !== 'listening') {
      return;
    }

    this.voiceSession.setState('processing');

    let recording: Awaited<ReturnType<AudioCaptureService['stop']>>;
    try {
      recording = await this.audioCapture.stop();
    } catch (err) {
      console.error('failed to stop recording', err);
      this.voiceSession.setState('error');
      return;
    }

    const language = this.settings.preferredLanguage();
    const voice = this.settings.preferredVoice();
    // sendVoiceTurn takes it from here — one orchestrated call runs
    // transcribe -> think -> speak and drives processing -> responding ->
    // idle itself (docs/DECISIONS.md ADR-024), the same way sendUserTurn
    // already does for typed text.
    this.conversation.sendVoiceTurn(recording.blob, language, voice);
  }

  private cancelRecording(): void {
    this.clearMaxDuration();
    this.audioCapture.cancel();
  }

  private clearMaxDuration(): void {
    if (this.maxDurationHandle !== undefined) {
      clearTimeout(this.maxDurationHandle);
      this.maxDurationHandle = undefined;
    }
  }
}
