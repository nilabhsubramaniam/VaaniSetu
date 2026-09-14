import { TestBed } from '@angular/core/testing';
import { LanguagePreferences } from './language-preferences';

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
});
