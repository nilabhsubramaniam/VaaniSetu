import { TestBed } from '@angular/core/testing';
import { LanguagePreferences } from './language-preferences';
import { SettingsStore } from '../../core/services/settings.store';

describe('LanguagePreferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders one option per language, radio-checked to match the current preference', () => {
    const fixture = TestBed.createComponent(LanguagePreferences);
    fixture.detectChanges();

    const options = (fixture.nativeElement as HTMLElement).querySelectorAll('.option');
    expect(options.length).toBeGreaterThan(1);

    const checked = Array.from(options).find((el) => el.getAttribute('aria-checked') === 'true');
    expect(checked?.textContent).toContain('Hindi');
  });

  it('disables options for languages not yet enabled', () => {
    const fixture = TestBed.createComponent(LanguagePreferences);
    fixture.detectChanges();

    const options = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.option'),
    ) as HTMLButtonElement[];
    const disabled = options.filter((el) => el.disabled);

    expect(disabled.length).toBeGreaterThan(0);
    expect(disabled.every((el) => el.textContent?.includes('Coming soon'))).toBe(true);
  });

  it('selecting an enabled option updates the checked state', () => {
    const fixture = TestBed.createComponent(LanguagePreferences);
    fixture.detectChanges();

    const options = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.option'),
    ) as HTMLButtonElement[];
    const hinglish = options.find((el) => el.textContent?.includes('Hinglish'))!;

    hinglish.click();
    fixture.detectChanges();

    expect(hinglish.getAttribute('aria-checked')).toBe('true');
  });

  it('shows an Auto-detect option, enabled', () => {
    const fixture = TestBed.createComponent(LanguagePreferences);
    fixture.detectChanges();

    const options = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.option'),
    ) as HTMLButtonElement[];
    const auto = options.find((el) => el.textContent?.includes('Auto-detect'));

    expect(auto).toBeTruthy();
    expect(auto?.disabled).toBe(false);
  });

  it('selecting Auto-detect turns on autoDetectLanguage without touching the pin', () => {
    const fixture = TestBed.createComponent(LanguagePreferences);
    fixture.detectChanges();

    const options = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.option'),
    ) as HTMLButtonElement[];
    const auto = options.find((el) => el.textContent?.includes('Auto-detect'))!;

    auto.click();
    fixture.detectChanges();

    const settingsStore = TestBed.inject(SettingsStore);
    expect(settingsStore.autoDetectLanguage()).toBe(true);
    expect(settingsStore.preferredLanguage()).toBe('hi');
    expect(auto.getAttribute('aria-checked')).toBe('true');
  });

  it('selecting a concrete language after Auto-detect turns auto-detect back off', () => {
    const fixture = TestBed.createComponent(LanguagePreferences);
    fixture.detectChanges();

    const options = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.option'),
    ) as HTMLButtonElement[];
    options.find((el) => el.textContent?.includes('Auto-detect'))!.click();
    fixture.detectChanges();

    const hinglish = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.option'),
    ).find((el) => el.textContent?.includes('Hinglish')) as HTMLButtonElement;
    hinglish.click();
    fixture.detectChanges();

    const settingsStore = TestBed.inject(SettingsStore);
    expect(settingsStore.autoDetectLanguage()).toBe(false);
    expect(settingsStore.preferredLanguage()).toBe('hinglish');
  });
});
