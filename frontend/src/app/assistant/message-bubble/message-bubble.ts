import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { StatusPill } from '../../shared/components/status-pill/status-pill';
import { languageLabel } from '../../core/models/language.model';
import type { Turn } from '../../core/models/turn.model';

@Component({
  selector: 'app-message-bubble',
  imports: [StatusPill],
  templateUrl: './message-bubble.html',
  styleUrl: './message-bubble.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessageBubble {
  readonly turn = input.required<Turn>();

  readonly languageName = computed(() => languageLabel(this.turn().language));
  readonly isAssistant = computed(() => this.turn().role === 'assistant');
  /** Drives the Devanagari font stack for Hindi text (see global styles.scss). */
  readonly langAttr = computed(() => (this.turn().language === 'hi' ? 'hi' : null));
  readonly timeLabel = computed(() =>
    this.turn().createdAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  );
}
