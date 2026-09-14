import { TestBed } from '@angular/core/testing';
import { PrivacyToggles } from './privacy-toggles';

describe('PrivacyToggles', () => {
  it('renders one switch per toggle, all off by default', () => {
    const fixture = TestBed.createComponent(PrivacyToggles);
    fixture.detectChanges();

    const switches = (fixture.nativeElement as HTMLElement).querySelectorAll('.switch');
    expect(switches.length).toBe(fixture.componentInstance.toggles.length);
    expect(Array.from(switches).every((el) => el.getAttribute('aria-checked') === 'false')).toBe(
      true,
    );
  });

  it('clicking a switch turns it on independently of the others', () => {
    const fixture = TestBed.createComponent(PrivacyToggles);
    fixture.detectChanges();

    const switches = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.switch'),
    ) as HTMLButtonElement[];

    switches[0].click();
    fixture.detectChanges();

    expect(switches[0].getAttribute('aria-checked')).toBe('true');
    expect(switches[1].getAttribute('aria-checked')).toBe('false');
  });

  it('is purely local — toggling does not persist across a new instance', () => {
    const fixture = TestBed.createComponent(PrivacyToggles);
    fixture.detectChanges();
    const firstSwitch = (fixture.nativeElement as HTMLElement).querySelector(
      '.switch',
    ) as HTMLButtonElement;
    firstSwitch.click();
    fixture.detectChanges();

    const secondFixture = TestBed.createComponent(PrivacyToggles);
    secondFixture.detectChanges();
    const freshSwitch = (secondFixture.nativeElement as HTMLElement).querySelector('.switch')!;

    expect(freshSwitch.getAttribute('aria-checked')).toBe('false');
  });
});
