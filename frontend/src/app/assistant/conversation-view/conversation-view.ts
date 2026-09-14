import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { MessageBubble } from '../message-bubble/message-bubble';
import { EXAMPLE_PROMPTS } from '../../core/models/example-prompt.model';
import type { LanguageCode } from '../../core/models/language.model';
import { ConversationService } from '../../core/services/conversation.service';
import { SettingsStore } from '../../core/services/settings.store';
import { VoiceSessionService } from '../../core/services/voice-session.service';

interface ExamplePrompt {
  readonly language: LanguageCode;
  /** Short label shown above the example, naming the language it's in. */
  readonly languageLabel: string;
  readonly text: string;
}

/**
 * A small, fixed showcase spanning the three languages Phase 1 actually
 * demonstrates (Hindi, Hinglish, and plain English), so a new user sees the
 * multilingual range immediately regardless of their current preference —
 * not just examples in whatever language happens to be selected already.
 */
const EMPTY_STATE_EXAMPLES: readonly ExamplePrompt[] = [
  { language: 'hi', languageLabel: 'Hindi', text: EXAMPLE_PROMPTS.hi },
  { language: 'hinglish', languageLabel: 'Hinglish', text: EXAMPLE_PROMPTS.hinglish },
  { language: 'en', languageLabel: 'English', text: EXAMPLE_PROMPTS.en },
];

/**
 * True when a scrollable element's position is within `thresholdPx` of its
 * bottom edge. Extracted as a plain function (rather than inlined in the
 * scroll handler) so the "should we auto-scroll" decision is unit-testable
 * with mocked scroll metrics — jsdom always reports 0 for
 * scrollTop/scrollHeight/clientHeight, so this can't be verified through a
 * real scroll in a component test, only through this pure function.
 */
export function isNearBottom(
  metrics: Pick<HTMLElement, 'scrollTop' | 'scrollHeight' | 'clientHeight'>,
  thresholdPx = 80,
): boolean {
  return metrics.scrollHeight - metrics.scrollTop - metrics.clientHeight <= thresholdPx;
}

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
  private readonly settings = inject(SettingsStore);
  private readonly scrollAnchor = viewChild<ElementRef<HTMLElement>>('scrollAnchor');
  private readonly viewportEl = viewChild<ElementRef<HTMLElement>>('viewport');

  readonly turns = this.conversation.turns;
  readonly isEmpty = computed(() => this.turns().length === 0);
  readonly isThinking = computed(() => this.voiceSession.state() === 'processing');
  readonly examples = EMPTY_STATE_EXAMPLES;

  /**
   * Starts `true` so the first turns to arrive stick to the bottom like any
   * normal chat. Once the user scrolls away from the bottom, new turns no
   * longer force-scroll them back — they have to return on their own, or
   * use the "jump to latest" affordance.
   */
  private readonly isPinnedToBottom = signal(true);
  readonly showJumpToLatest = computed(() => !this.isPinnedToBottom() && !this.isEmpty());

  constructor() {
    afterRenderEffect(() => {
      this.turns();
      if (this.isPinnedToBottom()) {
        this.scrollAnchor()?.nativeElement.scrollIntoView({ block: 'end' });
      }
    });
  }

  onScroll(): void {
    const el = this.viewportEl()?.nativeElement;
    if (el) {
      this.isPinnedToBottom.set(isNearBottom(el));
    }
  }

  jumpToLatest(): void {
    this.isPinnedToBottom.set(true);
    this.scrollAnchor()?.nativeElement.scrollIntoView({ block: 'end' });
  }

  /** Sends an empty-state example exactly like the user had typed it. */
  sendExample(example: ExamplePrompt): void {
    this.settings.setPreferredLanguage(example.language);
    this.conversation.sendUserTurn(example.text, example.language);
  }
}
