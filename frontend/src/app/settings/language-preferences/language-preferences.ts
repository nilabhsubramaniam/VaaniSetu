import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import {
  AUTO_DETECT_OPTION,
  LANGUAGE_OPTIONS,
  type ChatLanguageRequest,
} from '../../core/models/language.model';
import { SettingsStore } from '../../core/services/settings.store';

@Component({
  selector: 'app-language-preferences',
  templateUrl: './language-preferences.html',
  styleUrl: './language-preferences.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LanguagePreferences {
  private readonly settings = inject(SettingsStore);

  readonly options = [AUTO_DETECT_OPTION, ...LANGUAGE_OPTIONS];
  readonly preferredLanguage = this.settings.preferredLanguage;
  readonly autoDetectLanguage = this.settings.autoDetectLanguage;
  readonly effectiveSelection = this.settings.effectiveChatLanguage;

  select(code: ChatLanguageRequest): void {
    if (code === 'auto') {
      this.settings.setAutoDetectLanguage(true);
    } else {
      this.settings.setAutoDetectLanguage(false);
      this.settings.setPreferredLanguage(code);
    }
  }
}
