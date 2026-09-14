import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import { EXAMPLE_PROMPTS } from '../../core/models/example-prompt.model';
import { ConversationService } from '../../core/services/conversation.service';
import { SettingsStore } from '../../core/services/settings.store';
import { VoiceSessionService } from '../../core/services/voice-session.service';

/** How long the mic "listens" before auto-stopping, simulating VAD endpointing. */
const AUTO_STOP_DELAY_MS = 1500;

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
  private readonly destroyRef = inject(DestroyRef);

  private autoStopHandle: ReturnType<typeof setTimeout> | undefined;

  readonly state = this.voiceSession.state;
  readonly isListening = computed(() => this.state() === 'listening');
  readonly isBusy = computed(() => this.state() === 'processing' || this.state() === 'responding');

  constructor() {
    this.destroyRef.onDestroy(() => this.clearAutoStop());
  }

  onPress(): void {
    if (this.isBusy()) {
      return; // a reply is already in flight; wait for it to finish
    }

    if (this.isListening()) {
      this.stopListeningAndSend();
      return;
    }

    this.voiceSession.setState('listening');
    this.autoStopHandle = setTimeout(() => this.stopListeningAndSend(), AUTO_STOP_DELAY_MS);
  }

  private stopListeningAndSend(): void {
    this.clearAutoStop();
    if (this.state() !== 'listening') {
      return;
    }
    const language = this.settings.preferredLanguage();
    const transcript = EXAMPLE_PROMPTS[language] ?? EXAMPLE_PROMPTS['en'];
    this.conversation.sendUserTurn(transcript, language);
  }

  private clearAutoStop(): void {
    if (this.autoStopHandle !== undefined) {
      clearTimeout(this.autoStopHandle);
      this.autoStopHandle = undefined;
    }
  }
}
