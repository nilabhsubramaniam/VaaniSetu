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
    expect(options.length).toBe(11);
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
    const fixture = TestBed.createComponent(LanguageSelector);
    fixture.detectChanges();

    fixture.componentInstance.open();
    fixture.detectChanges();

    const options = (fixture.nativeElement as HTMLElement).querySelectorAll<HTMLLIElement>(
      '.option',
    );
    const bengaliOption = Array.from(options).find((el) => el.textContent?.includes('বাংলা'))!;
    bengaliOption.click();
    fixture.detectChanges();

    const settingsStore = TestBed.inject(SettingsStore);
    expect(settingsStore.preferredLanguage()).toBe('hi');
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
