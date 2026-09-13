import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ConversationView } from './conversation-view/conversation-view';
import { MicButton } from './mic-button/mic-button';
import { TextInputBar } from './text-input-bar/text-input-bar';
import { VoiceStateIndicator } from './voice-state-indicator/voice-state-indicator';
import { ConversationService } from '../core/services/conversation.service';
import { VoiceSessionService } from '../core/services/voice-session.service';

@Component({
  selector: 'app-assistant-page',
  imports: [ConversationView, MicButton, TextInputBar, VoiceStateIndicator],
  templateUrl: './assistant.page.html',
  styleUrl: './assistant.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistantPage {
  private readonly conversation = inject(ConversationService);
  private readonly voiceSession = inject(VoiceSessionService);

  readonly hasError = computed(() => this.voiceSession.state() === 'error');

  /** Dev/demo affordance — see ConversationService.simulateError doc comment. */
  onSimulateError(): void {
    this.conversation.simulateError();
  }
}
