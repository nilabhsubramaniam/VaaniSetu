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

  it('points the secondary CTA at the how-it-works section', () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
    const secondary = (fixture.nativeElement as HTMLElement).querySelector('.btn-secondary')!;

    expect(secondary.getAttribute('href')).toBe('#how-it-works');
  });

  it('renders all eight pipeline steps in order', () => {
    const fixture = TestBed.createComponent(LandingPage);
    fixture.detectChanges();
    const steps = (fixture.nativeElement as HTMLElement).querySelectorAll('.pipeline-step');

    expect(steps).toHaveLength(8);
    expect(steps[0].textContent).toContain('Microphone');
    expect(steps[7].textContent).toContain('Voice response');
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
});
