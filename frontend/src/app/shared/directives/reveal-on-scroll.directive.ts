import { Directive, ElementRef, OnInit, DestroyRef, inject } from '@angular/core';

/**
 * Adds an `.is-visible` class the first time the host element scrolls into
 * view, using the native `IntersectionObserver` (no animation library).
 * The paired `.reveal-on-scroll` / `.is-visible` CSS lives in the global
 * `styles.scss` alongside the app's other shared utility classes, so any
 * future page can reuse this the same way.
 *
 * Respects `prefers-reduced-motion`: when set, the element is marked
 * visible immediately and never observed, so there is no motion at all —
 * not just a shorter one.
 */
@Directive({
  selector: '[appRevealOnScroll]',
})
export class RevealOnScroll implements OnInit {
  private readonly elementRef = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  ngOnInit(): void {
    const element = this.elementRef.nativeElement;
    const reducedMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

    if (reducedMotion || typeof IntersectionObserver === 'undefined') {
      element.classList.add('is-visible');
      return;
    }

    element.classList.add('reveal-on-scroll');

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            element.classList.add('is-visible');
            observer.unobserve(element);
          }
        }
      },
      { threshold: 0.15 },
    );

    observer.observe(element);
    this.destroyRef.onDestroy(() => observer.disconnect());
  }
}
