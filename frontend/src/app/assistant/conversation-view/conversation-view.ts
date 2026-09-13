import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  viewChild,
} from '@angular/core';
import { MessageBubble } from '../message-bubble/message-bubble';
import { ConversationService } from '../../core/services/conversation.service';
import { VoiceSessionService } from '../../core/services/voice-session.service';

@Component({
  selector: 'app-conversation-view',
  imports: [MessageBubble],
  templateUrl: './conversation-view.html',
  styleUrl: './conversation-view.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConversationView {
  private readonly conversation = inject(ConversationService);
  private readonly voiceSession = inject(VoiceSessionService);
  private readonly scrollAnchor = viewChild<ElementRef<HTMLElement>>('scrollAnchor');

  readonly turns = this.conversation.turns;
  readonly isEmpty = computed(() => this.turns().length === 0);
  readonly isThinking = computed(() => this.voiceSession.state() === 'processing');

  constructor() {
    // Keep the latest turn in view whenever the list grows.
    afterRenderEffect(() => {
      this.turns();
      this.scrollAnchor()?.nativeElement.scrollIntoView({ block: 'end' });
    });
  }
}
