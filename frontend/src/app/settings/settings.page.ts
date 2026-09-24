import { ChangeDetectionStrategy, Component } from '@angular/core';
import { LanguagePreferences } from './language-preferences/language-preferences';
import { ModelSelectionPlaceholder } from './model-selection-placeholder/model-selection-placeholder';
import { PrivacyToggles } from './privacy-toggles/privacy-toggles';
import { VoicePreferences } from './voice-preferences/voice-preferences';

@Component({
  selector: 'app-settings-page',
  imports: [LanguagePreferences, VoicePreferences, PrivacyToggles, ModelSelectionPlaceholder],
  templateUrl: './settings.page.html',
  styleUrl: './settings.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsPage {}
