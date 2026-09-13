import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ConversationService } from '../../core/services/conversation.service';
import { SettingsStore } from '../../core/services/settings.store';
import { VoiceSessionService } from '../../core/services/voice-session.service';

/**
 * Always-available fallback for the mic, and the only input path exercised
 * by keyboard-only or screen-reader users. Shares the same
 * `ConversationService.sendUserTurn` call as the mic button, so both input
 * modes drive one interaction model (`docs/ROADMAP.md` Phase 1).
 */
@Component({
  selector: 'app-text-input-bar',
  templateUrl: './text-input-bar.html',
  styleUrl: './text-input-bar.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextInputBar {
  private readonly conversation = inject(ConversationService);
  private readonly voiceSession = inject(VoiceSessionService);
  private readonly settings = inject(SettingsStore);

  readonly draft = signal('');
  private readonly isBusy = computed(() => {
    const state = this.voiceSession.state();
    return state === 'processing' || state === 'responding';
  });
  readonly canSend = computed(() => this.draft().trim().length > 0 && !this.isBusy());

  onInput(value: string): void {
    this.draft.set(value);
  }

  send(): void {
    if (!this.canSend()) {
      return;
    }
    this.conversation.sendUserTurn(this.draft(), this.settings.preferredLanguage());
    this.draft.set('');
  }
}
