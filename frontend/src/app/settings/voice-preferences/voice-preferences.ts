import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { VOICE_OPTIONS } from '../../core/models/voice.model';
import { SettingsStore } from '../../core/services/settings.store';

@Component({
  selector: 'app-voice-preferences',
  templateUrl: './voice-preferences.html',
  styleUrl: './voice-preferences.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoicePreferences {
  private readonly settings = inject(SettingsStore);

  readonly options = VOICE_OPTIONS;
  readonly preferredVoice = this.settings.preferredVoice;

  select(code: (typeof VOICE_OPTIONS)[number]['code']): void {
    this.settings.setPreferredVoice(code);
  }
}
