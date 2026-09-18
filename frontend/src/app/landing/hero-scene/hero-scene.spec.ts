import { TestBed } from '@angular/core/testing';
import { HeroScene } from './hero-scene';

/**
 * jsdom (this project's test environment) has no real WebGL
 * implementation — `canvas.getContext('webgl')` always returns `null`
 * here, regardless of what a real browser would do. That means these
 * tests can only exercise this component's "WebGL unsupported" bail-out
 * path, never the actual Three.js scene setup — there is no way to unit
 * test real WebGL rendering in this stack. The bail-out path is exactly
 * the one every visitor without WebGL, and every visitor with
 * `prefers-reduced-motion` set, actually takes, so it's a real path, not
 * a throwaway one.
 */
describe('HeroScene', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({});
  });

  it('creates without error', () => {
    const fixture = TestBed.createComponent(HeroScene);
    expect(() => fixture.detectChanges()).not.toThrow();
  });

  it('does not throw during ngAfterViewInit when WebGL is unavailable (jsdom default)', async () => {
    const fixture = TestBed.createComponent(HeroScene);
    fixture.detectChanges();
    await fixture.whenStable();
    // No assertion beyond "didn't throw" — there's nothing else
    // observable from outside the component in this bail-out path (no
    // canvas is ever drawn into, no listeners are attached).
  });

  it('does not throw when the component is destroyed immediately after creation', async () => {
    const fixture = TestBed.createComponent(HeroScene);
    fixture.detectChanges();
    await fixture.whenStable();
    expect(() => fixture.destroy()).not.toThrow();
  });

  it('renders a decorative, non-interactive canvas element', () => {
    const fixture = TestBed.createComponent(HeroScene);
    fixture.detectChanges();

    const canvas = (fixture.nativeElement as HTMLElement).querySelector('canvas');
    expect(canvas).toBeTruthy();
    expect(canvas?.getAttribute('aria-hidden')).toBe('true');
  });

  it('accepts a progress input without error, at either end of its range', () => {
    const fixture = TestBed.createComponent(HeroScene);
    fixture.componentRef.setInput('progress', 0);
    expect(() => fixture.detectChanges()).not.toThrow();

    fixture.componentRef.setInput('progress', 1);
    expect(() => fixture.detectChanges()).not.toThrow();
  });
});
