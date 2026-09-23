import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * A CSS-only "namaste dissolves into hello" transform, illustrating
 * translation without any Three.js/canvas cost — this section sits well
 * below the fold, so it doesn't need the hero's WebGL budget.
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
  readonly sourceText = input<string>('नमस्ते');
  readonly targetText = input<string>('Hello');
}
