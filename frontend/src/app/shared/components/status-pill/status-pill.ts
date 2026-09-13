import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * Tone controls color only. Reused for both a language badge on a message
 * bubble and the voice-state label — the two places Phase 1 needs a small
 * status chip.
 */
export type StatusPillTone = 'neutral' | 'accent' | 'error' | 'idle' | 'processing' | 'responding';

@Component({
  selector: 'app-status-pill',
  templateUrl: './status-pill.html',
  styleUrl: './status-pill.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StatusPill {
  readonly label = input.required<string>();
  readonly tone = input<StatusPillTone>('neutral');
}
