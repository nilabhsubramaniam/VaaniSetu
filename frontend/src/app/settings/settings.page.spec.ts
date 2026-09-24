import { TestBed } from '@angular/core/testing';
import { SettingsPage } from './settings.page';

describe('SettingsPage', () => {
  it('renders the page heading and all four settings sections', () => {
    const fixture = TestBed.createComponent(SettingsPage);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h1')?.textContent).toContain('Settings');
    expect(el.querySelector('app-language-preferences')).not.toBeNull();
    expect(el.querySelector('app-voice-preferences')).not.toBeNull();
    expect(el.querySelector('app-privacy-toggles')).not.toBeNull();
    expect(el.querySelector('app-model-selection-placeholder')).not.toBeNull();
  });
});
