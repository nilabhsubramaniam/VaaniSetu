import { TestBed } from '@angular/core/testing';
import { VoicePreferences } from './voice-preferences';

describe('VoicePreferences', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders one option per voice, radio-checked to match the current preference', () => {
    const fixture = TestBed.createComponent(VoicePreferences);
    fixture.detectChanges();

    const options = (fixture.nativeElement as HTMLElement).querySelectorAll('.option');
    expect(options.length).toBe(2);

    const checked = Array.from(options).find((el) => el.getAttribute('aria-checked') === 'true');
    expect(checked?.textContent).toContain('Female');
  });

  it('selecting an option updates the checked state and persists the choice', () => {
    const fixture = TestBed.createComponent(VoicePreferences);
    fixture.detectChanges();

    const options = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.option'),
    ) as HTMLButtonElement[];
    const male = options.find((el) => el.textContent?.includes('Male'))!;

    male.click();
    fixture.detectChanges();

    expect(male.getAttribute('aria-checked')).toBe('true');
    expect(localStorage.getItem('vaanisetu.settings.preferredVoice')).toBe('male');
  });
});
