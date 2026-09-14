import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { RevealOnScroll } from './reveal-on-scroll.directive';

@Component({
  imports: [RevealOnScroll],
  template: `<div appRevealOnScroll>content</div>`,
})
class HostComponent {}

describe('RevealOnScroll', () => {
  let observedCallback: IntersectionObserverCallback | undefined;
  let unobserve: ReturnType<typeof vi.fn>;
  let disconnect: ReturnType<typeof vi.fn>;
  let originalIntersectionObserver: typeof IntersectionObserver | undefined;
  let originalMatchMedia: typeof window.matchMedia;

  beforeEach(() => {
    originalIntersectionObserver = globalThis.IntersectionObserver;
    originalMatchMedia = window.matchMedia;
    unobserve = vi.fn();
    disconnect = vi.fn();

    class FakeIntersectionObserver {
      constructor(callback: IntersectionObserverCallback) {
        observedCallback = callback;
      }
      observe = vi.fn();
      unobserve = unobserve;
      disconnect = disconnect;
    }
    globalThis.IntersectionObserver =
      FakeIntersectionObserver as unknown as typeof IntersectionObserver;

    window.matchMedia = vi
      .fn()
      .mockReturnValue({ matches: false }) as unknown as typeof window.matchMedia;
  });

  afterEach(() => {
    globalThis.IntersectionObserver = originalIntersectionObserver as typeof IntersectionObserver;
    window.matchMedia = originalMatchMedia;
  });

  it('does not mark the element visible before it intersects', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = (fixture.nativeElement as HTMLElement).querySelector('div')!;

    expect(el.classList.contains('reveal-on-scroll')).toBe(true);
    expect(el.classList.contains('is-visible')).toBe(false);
  });

  it('adds is-visible and stops observing once it intersects', () => {
    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = (fixture.nativeElement as HTMLElement).querySelector('div')!;

    observedCallback?.(
      [{ isIntersecting: true, target: el } as unknown as IntersectionObserverEntry],
      {} as IntersectionObserver,
    );

    expect(el.classList.contains('is-visible')).toBe(true);
    expect(unobserve).toHaveBeenCalledWith(el);
  });

  it('skips the observer entirely and is immediately visible under reduced motion', () => {
    window.matchMedia = vi
      .fn()
      .mockReturnValue({ matches: true }) as unknown as typeof window.matchMedia;

    const fixture = TestBed.createComponent(HostComponent);
    fixture.detectChanges();
    const el = (fixture.nativeElement as HTMLElement).querySelector('div')!;

    expect(el.classList.contains('is-visible')).toBe(true);
    expect(el.classList.contains('reveal-on-scroll')).toBe(false);
  });
});
