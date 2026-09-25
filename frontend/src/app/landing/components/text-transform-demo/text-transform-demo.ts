import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A CSS-only "casual Hinglish dissolves into a natural Hindi reply"
 * transform, illustrating VaaniSetu understanding how you actually speak
 * — not translating for someone else — without any Three.js/canvas cost.
 * This section sits well below the fold, so it doesn't need the hero's
 * WebGL budget. Deliberately a same-audience pair (romanized Hindi-English
 * code-switching in, a clean spoken Hindi reply out), not a
 * language-to-language translation pair, per docs/PROJECT_GOAL.md's
 * single-user-assistant framing.
 */
@Component({
  selector: 'app-text-transform-demo',
  templateUrl: './text-transform-demo.html',
  styleUrl: './text-transform-demo.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TextTransformDemo {
  readonly heading = input.required<string>();
  readonly description = input.required<string>();
  readonly sourceText = input<string>('kal milte hain');
  readonly targetText = input<string>('कल मिलते हैं');
}
