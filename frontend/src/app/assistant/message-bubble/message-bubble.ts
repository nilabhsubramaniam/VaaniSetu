import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { StatusPill } from '../../shared/components/status-pill/status-pill';
import { languageLabel, type LanguageCode } from '../../core/models/language.model';
import type { Turn } from '../../core/models/turn.model';

// Languages with their own self-hosted, script-specific font stack (see
// global styles.scss's `[lang='...']` rules) — every other LanguageCode
// (Hinglish included, since it's Latin-script) renders fine in the
// default Latin stack and needs no `lang` attribute override.
const SCRIPT_SPECIFIC_LANGUAGES: ReadonlySet<LanguageCode> = new Set(['hi', 'ml']);

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
  /** Drives the script-specific font stack for the turn's language (see global styles.scss). */
  readonly langAttr = computed(() => {
    const language = this.turn().language;
    return SCRIPT_SPECIFIC_LANGUAGES.has(language) ? language : null;
  });
  readonly timeLabel = computed(() =>
    this.turn().createdAt.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' }),
  );
}
