import { TestBed } from '@angular/core/testing';
import { LandingI18nService } from './landing-i18n.service';
import { SettingsStore } from '../../core/services/settings.store';

describe('LandingI18nService', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('defaults to Hindi copy, matching SettingsStore’s default language', () => {
    const service = TestBed.inject(LandingI18nService);
    expect(service.locale()).toBe('hi');
    expect(service.t().hero.cta).toBe('वाणीसेतु आज़माएँ');
  });

  it('switches to English copy when the preferred language is English', () => {
    const settingsStore = TestBed.inject(SettingsStore);
    settingsStore.setPreferredLanguage('en');

    const service = TestBed.inject(LandingI18nService);
    expect(service.locale()).toBe('en');
    expect(service.t().hero.cta).toBe('Try VaaniSetu');
  });

  it('treats hinglish as Hindi copy, since there is no separate Hinglish translation', () => {
    const settingsStore = TestBed.inject(SettingsStore);
    settingsStore.setPreferredLanguage('hinglish');

    const service = TestBed.inject(LandingI18nService);
    expect(service.locale()).toBe('hi');
  });
});
