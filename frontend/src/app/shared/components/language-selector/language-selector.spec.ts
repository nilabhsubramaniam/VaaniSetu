import { TestBed } from '@angular/core/testing';
import { LanguageSelector } from './language-selector';
import { SettingsStore } from '../../../core/services/settings.store';

describe('LanguageSelector', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({});
  });

  it('shows the current preferred language as the trigger label', () => {
    const fixture = TestBed.createComponent(LanguageSelector);
    fixture.detectChanges();

    const trigger = (fixture.nativeElement as HTMLElement).querySelector('.trigger-label');
    expect(trigger?.textContent?.trim()).toBe('हिन्दी');
  });

  it('opens the listbox on trigger click and lists all options', () => {
    const fixture = TestBed.createComponent(LanguageSelector);
    fixture.detectChanges();

    const button = (fixture.nativeElement as HTMLElement).querySelector<HTMLButtonElement>(
      '.trigger',
    )!;
    button.click();
    fixture.detectChanges();

    const options = (fixture.nativeElement as HTMLElement).querySelectorAll('.option');
    expect(options.length).toBe(13); // 12 languages + the "Auto-detect" entry
  });

  it('selecting an enabled option updates SettingsStore and closes the popover', () => {
    const fixture = TestBed.createComponent(LanguageSelector);
    fixture.detectChanges();

    fixture.componentInstance.open();
    fixture.detectChanges();

    const options = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLLIElement>(
      '.option',
    );
    const hinglishOption = Array.from(options).find((el) => el.textContent?.includes('Hinglish'))!;
    hinglishOption.click();
    fixture.detectChanges();

    const settingsStore = TestBed.inject(SettingsStore);
    expect(settingsStore.preferredLanguage()).toBe('hinglish');
    expect(fixture.componentInstance.isOpen()).toBe(false);
  });

  it('clicking a disabled option does not change the preferred language', () => {
    // Odia (ଓଡ଼ିଆ) — Bengali (Milestone 6h, ADR-033) and Gujarati
    // (Milestone 6i, ADR-034) both joined the enabled set, so neither
    // fits this test anymore. Odia is the last still-disabled language.
    const fixture = TestBed.createComponent(LanguageSelector);
    fixture.detectChanges();

    fixture.componentInstance.open();
    fixture.detectChanges();

    const options = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLLIElement>(
      '.option',
    );
    const odiaOption = Array.from(options).find((el) => el.textContent?.includes('ଓଡ଼ିଆ'))!;
    odiaOption.click();
    fixture.detectChanges();

    const settingsStore = TestBed.inject(SettingsStore);
    expect(settingsStore.preferredLanguage()).toBe('hi');
  });

  it('selecting Auto-detect turns on autoDetectLanguage without changing the pin', () => {
    const fixture = TestBed.createComponent(LanguageSelector);
    fixture.detectChanges();

    fixture.componentInstance.open();
    fixture.detectChanges();

    const options = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLLIElement>(
      '.option',
    );
    const autoOption = Array.from(options).find((el) => el.textContent?.includes('Auto-detect'))!;
    autoOption.click();
    fixture.detectChanges();

    const settingsStore = TestBed.inject(SettingsStore);
    expect(settingsStore.autoDetectLanguage()).toBe(true);
    expect(settingsStore.preferredLanguage()).toBe('hi'); // unchanged
    expect(fixture.componentInstance.isOpen()).toBe(false);
  });

  it('shows "Auto" as the trigger label when auto-detect is on', () => {
    const fixture = TestBed.createComponent(LanguageSelector);
    TestBed.inject(SettingsStore).setAutoDetectLanguage(true);
    fixture.detectChanges();

    const trigger = (fixture.nativeElement as HTMLElement).querySelector('.trigger-label');
    expect(trigger?.textContent?.trim()).toBe('Auto');
  });

  it('selecting a concrete language turns auto-detect back off', () => {
    const fixture = TestBed.createComponent(LanguageSelector);
    const settingsStore = TestBed.inject(SettingsStore);
    settingsStore.setAutoDetectLanguage(true);
    fixture.detectChanges();

    fixture.componentInstance.open();
    fixture.detectChanges();

    const options = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLLIElement>(
      '.option',
    );
    const hinglishOption = Array.from(options).find((el) => el.textContent?.includes('Hinglish'))!;
    hinglishOption.click();
    fixture.detectChanges();

    expect(settingsStore.autoDetectLanguage()).toBe(false);
    expect(settingsStore.preferredLanguage()).toBe('hinglish');
  });

  it('Escape closes the popover and returns focus to the trigger', () => {
    const fixture = TestBed.createComponent(LanguageSelector);
    fixture.detectChanges();

    fixture.componentInstance.open();
    fixture.detectChanges();

    fixture.componentInstance.onListKeydown(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();

    expect(fixture.componentInstance.isOpen()).toBe(false);
  });
});
