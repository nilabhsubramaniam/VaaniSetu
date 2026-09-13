import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * Disabled by design. No model is selected yet — see
 * docs/DECISIONS.md ADR-008. This exists only so the settings screen has a
 * home for model choice once Phase 2 benchmarks pick a default.
 */
@Component({
  selector: 'app-model-selection-placeholder',
  templateUrl: './model-selection-placeholder.html',
  styleUrl: './model-selection-placeholder.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModelSelectionPlaceholder {}
