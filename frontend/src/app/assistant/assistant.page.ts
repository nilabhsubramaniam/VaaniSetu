import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { ConversationView } from './conversation-view/conversation-view';
import { MicButton } from './mic-button/mic-button';
import { TextInputBar } from './text-input-bar/text-input-bar';
import { VoiceStateIndicator } from './voice-state-indicator/voice-state-indicator';
import { LanguageSelector } from '../shared/components/language-selector/language-selector';
import { ConversationService } from '../core/services/conversation.service';
import { VoiceSessionService } from '../core/services/voice-session.service';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-assistant-page',
  imports: [ConversationView, MicButton, TextInputBar, VoiceStateIndicator, LanguageSelector],
  templateUrl: './assistant.page.html',
  styleUrl: './assistant.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AssistantPage {
  private readonly conversation = inject(ConversationService);
  private readonly voiceSession = inject(VoiceSessionService);

  readonly hasError = computed(() => this.voiceSession.state() === 'error');

  /**
   * Gates the "Simulate error (dev)" affordance out of production builds.
   * `ng build`'s default (production) configuration loads `environment.ts`
   * (`production: true`); `ng serve` and `ng test` load
   * `environment.development.ts` (`production: false`), so this control
   * stays available for local development and for the test that exercises
   * the error state, while never shipping in the real build.
   */
  readonly isProduction = environment.production;

  /** Dev/demo affordance — see ConversationService.simulateError doc comment. */
  onSimulateError(): void {
    this.conversation.simulateError();
  }
}
