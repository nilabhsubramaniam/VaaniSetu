import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { LandingPage } from './landing.page';

describe('LandingPage', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideRouter([])],
    });
  });

  it('renders exactly one h1 with the hero headline', () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
    const headings = (fixture.nativeElement as HTMLElement).querySelectorAll('h1');

    expect(headings).toHaveLength(1);
    expect(headings[0].textContent).toContain('Speak your language');
  });

  it('points the primary CTA at the assistant workspace', () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
    const primary = (fixture.nativeElement as HTMLElement).querySelector('.btn-primary')!;

    expect(primary.getAttribute('href')).toBe('/assistant');
  });

  it('renders the four story stage captions in order', () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
    const captions = (fixture.nativeElement as HTMLElement).querySelectorAll('.hero-caption');

    expect(captions).toHaveLength(4);
    expect(captions[0].textContent).toContain('Listen');
    expect(captions[3].textContent).toContain('Respond');
  });

  it('renders the hero-scene component host for the 3D mechanism', () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();

    // @defer (on idle): not guaranteed to have rendered synchronously in
    // a test, so this only asserts the template wiring compiles and
    // renders without error — hero-scene.spec.ts covers the component
    // itself.
    expect(() => fixture.detectChanges()).not.toThrow();
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

  describe('with prefers-reduced-motion set', () => {
    let originalMatchMedia: typeof window.matchMedia;

    beforeEach(() => {
      originalMatchMedia = window.matchMedia;
      window.matchMedia = vi
        .fn()
        .mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;
    });

    afterEach(() => {
      window.matchMedia = originalMatchMedia;
    });

    it('renders the story as a static, always-visible list, not a scroll-pinned one', () => {
      const fixture = TestBed.createComponent(LandingPage);
      fixture.detectChanges();
      const host = fixture.nativeElement as HTMLElement;

      expect(host.querySelector('.hero-story--static')).toBeTruthy();
      expect(host.querySelector('.hero-captions--static')).toBeTruthy();
    });

    it('keeps every caption fully visible regardless of scroll position', () => {
      const fixture = TestBed.createComponent(LandingPage);
      const component = fixture.componentInstance;

      for (let i = 0; i < 4; i++) {
        expect(component.captionOpacity(i)).toBe(1);
      }
    });

    it('does not attach a scroll listener', () => {
      const addSpy = vi.spyOn(window, 'addEventListener');
      const fixture = TestBed.createComponent(LandingPage);
      fixture.detectChanges();

      expect(addSpy).not.toHaveBeenCalledWith('scroll', expect.anything(), expect.anything());
      addSpy.mockRestore();
    });
  });

  describe('caption and hint opacity math', () => {
    it('weighs the first caption fully visible and the rest hidden at the very start of the story', () => {
      const fixture = TestBed.createComponent(LandingPage);
      const component = fixture.componentInstance;
      component.storyProgress.set(0);

      expect(component.captionOpacity(0)).toBeCloseTo(1, 5);
      expect(component.captionOpacity(3)).toBeCloseTo(0, 5);
    });

    it('fades the scroll hint out as soon as scrolling begins', () => {
      const fixture = TestBed.createComponent(LandingPage);
      const component = fixture.componentInstance;

      component.storyProgress.set(0);
      expect(component.scrollHintOpacity()).toBe(1);

      component.storyProgress.set(0.3);
      expect(component.scrollHintOpacity()).toBe(0);
    });
  });
});
