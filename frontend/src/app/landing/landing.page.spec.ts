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

  it('falls back to the plain CSS glow (never a static image) when WebGL is unsupported', () => {
    // jsdom has no real WebGL, so supportsWebGL() is always false here —
    // this is the real "unsupported browser" case, not simulated.
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(fixture.componentInstance.showHeroCanvas()).toBe(false);
    expect(el.querySelector('app-hero-canvas')).toBeNull();
    expect(el.querySelector('img')).toBeNull();
    expect(el.querySelector('.mic-art-fallback')).toBeTruthy();
  });

  it('renders the real mic control in the hero-stage regardless of which visual path is active', () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('.mic-overlay')).toBeTruthy();
    const micButton = el.querySelector<HTMLButtonElement>('.btn-mic');
    expect(micButton?.getAttribute('aria-label')).toBe('Start speaking');
  });

  it('renders exactly one h1 with the split hero headline', () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
    const headings = (fixture.nativeElement as HTMLElement).querySelectorAll('h1');

    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toContain('Speak');
    expect(headings[0].textContent).toContain('naturally.');
    expect(headings[0].textContent).toContain('Connect');
    expect(headings[0].textContent).toContain('across India.');
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

  it('heroRegions has real, distinct language codes matching demoLanguages entries', () => {
    // Not rendered as DOM in this test environment (HeroCanvas never
    // mounts — no WebGL in jsdom), but the data itself, which
    // HeroCanvas's chips and hero-scene.ts's connection paths both
    // depend on, should stay internally consistent.
    const fixture = TestBed.createComponent(LandingPage);
    const { heroRegions, demoLanguages } = fixture.componentInstance;

    expect(heroRegions.length).toBe(6);
    for (const region of heroRegions) {
      expect(demoLanguages.some((l) => l.code === region.languageCode), region.region).toBe(true);
    }
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

  it('cycles the status panel through voice -> language -> translation -> connection -> ready', () => {
    vi.useFakeTimers();
    try {
      const fixture = TestBed.createComponent(LandingPage);
      fixture.detectChanges();

      fixture.componentInstance.triggerMicDemo();
      expect(fixture.componentInstance.currentHudPhase()).toBe('voice');

      vi.advanceTimersByTime(1000);
      expect(fixture.componentInstance.currentHudPhase()).toBe('language');

      vi.advanceTimersByTime(500);
      expect(fixture.componentInstance.currentHudPhase()).toBe('translation');

      vi.advanceTimersByTime(500);
      expect(fixture.componentInstance.currentHudPhase()).toBe('connection');

      vi.advanceTimersByTime(1000);
      expect(fixture.componentInstance.currentHudPhase()).toBe('ready');
    } finally {
      vi.useRealTimers();
    }
  });
});
