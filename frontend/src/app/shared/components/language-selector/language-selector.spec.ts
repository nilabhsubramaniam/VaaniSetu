import { TestBed } from '@angular/core/testing';
import { LanguageSelector } from './language-selector';
import { LANGUAGE_OPTIONS } from '../../../core/models/language.model';
import { SettingsStore } from '../../../core/services/settings.store';

describe('LanguageSelector', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders one option per language, disabling those not yet enabled', () => {
    const fixture = TestBed.createComponent(LanguageSelector);
    fixture.detectChanges();

    const opts = (fixture.nativeElement as HTMLElement).querySelectorAll('option');
    expect(opts.length).toBe(LANGUAGE_OPTIONS.length);

    const disabledCount = Array.from(opts).filter((o) => (o as HTMLOptionElement).disabled).length;
    expect(disabledCount).toBe(LANGUAGE_OPTIONS.filter((l) => !l.enabled).length);
  });

  it('changing the select updates the shared language preference', () => {
    const fixture = TestBed.createComponent(LanguageSelector);
    fixture.detectChanges();
    const settings = TestBed.inject(SettingsStore);

    const select = (fixture.nativeElement as HTMLElement).querySelector(
      'select',
    ) as HTMLSelectElement;
    select.value = 'hinglish';
    select.dispatchEvent(new Event('change'));

    expect(settings.preferredLanguage()).toBe('hinglish');
  });
});
