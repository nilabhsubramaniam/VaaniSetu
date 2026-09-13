import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { LANGUAGE_OPTIONS } from '../../core/models/language.model';
import { SettingsStore } from '../../core/services/settings.store';

@Component({
  selector: 'app-language-preferences',
  templateUrl: './language-preferences.html',
  styleUrl: './language-preferences.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguagePreferences {
  private readonly settings = inject(SettingsStore);

  readonly options = LANGUAGE_OPTIONS;
  readonly preferredLanguage = this.settings.preferredLanguage;

  select(code: (typeof LANGUAGE_OPTIONS)[number]['code']): void {
    this.settings.setPreferredLanguage(code);
  }
}
