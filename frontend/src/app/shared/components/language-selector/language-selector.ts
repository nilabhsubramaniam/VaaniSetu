import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LANGUAGE_OPTIONS } from '../../../core/models/language.model';
import { SettingsStore } from '../../../core/services/settings.store';

/**
 * Global language preference control, shown in the header. Lists every
 * long-term language from docs/PROJECT_GOAL.md; only Hindi and Hinglish are
 * enabled in Phase 1, the rest render disabled as "coming soon" so the
 * eventual breadth is visible without being built yet.
 */
@Component({
  selector: 'app-language-selector',
  templateUrl: './language-selector.html',
  styleUrl: './language-selector.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguageSelector {
  private readonly settings = inject(SettingsStore);

  readonly options = LANGUAGE_OPTIONS;
  readonly preferredLanguage = this.settings.preferredLanguage;

  onChange(event: Event): void {
    const value = (event.target as HTMLSelectElement).value;
    this.settings.setPreferredLanguage(value as (typeof LANGUAGE_OPTIONS)[number]['code']);
  }
}
