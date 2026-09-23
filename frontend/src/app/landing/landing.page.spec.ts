import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { LandingPage } from './landing.page';
import { SettingsStore } from '../core/services/settings.store';

describe('LandingPage', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
    TestBed.inject(SettingsStore).setPreferredLanguage('en');
  });

  it('renders exactly one h1 with the split hero headline', () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
    const headings = (fixture.nativeElement as HTMLElement).querySelectorAll('h1');

    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toContain('Speak');
    expect(headings[0].textContent).toContain('naturally.');
    expect(headings[0].textContent).toContain('Connect');
    expect(headings[0].textContent).toContain('globally.');
  });

  it('points the primary CTA at the assistant workspace', () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
    const cta = (fixture.nativeElement as HTMLElement).querySelector('.cta-pill')!;

    expect(cta.getAttribute('href')).toBe('/assistant');
  });

  it('renders the accessible language node list as real, focusable buttons', () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
    const buttons = (fixture.nativeElement as HTMLElement).querySelectorAll(
      '.language-node-button',
    );

    expect(buttons.length).toBe(fixture.componentInstance.demoLanguages.length);
  });

  it('lists Hindi and Hinglish as available, and a future language as coming next', () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
    const groups = (fixture.nativeElement as HTMLElement).querySelectorAll('.lang-group');

    expect(groups[0].textContent).toContain('Hindi');
    expect(groups[0].textContent).toContain('Hinglish');
    expect(groups[1].textContent).toContain('Bengali');
  });

  it('marks not-yet-built capabilities with a planned note', () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';

    expect(text).toContain('planned — not yet implemented');
  });

  it('triggers the mic demo and shows the listening hint', () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();

    fixture.componentInstance.triggerMicDemo();
    fixture.detectChanges();

    expect(fixture.componentInstance.isMicDemoActive()).toBe(true);
    const hint = (fixture.nativeElement as HTMLElement).querySelector('.mic-hint');
    expect(hint?.textContent).toContain('Listening');
  });
});
