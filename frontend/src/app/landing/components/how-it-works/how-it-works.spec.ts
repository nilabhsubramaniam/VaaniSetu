import { TestBed } from '@angular/core/testing';
import { HowItWorks } from './how-it-works';

describe('HowItWorks', () => {
  it('renders one step per input entry, numbered in order', () => {
    const fixture = TestBed.createComponent(HowItWorks);
    fixture.componentRef.setInput('heading', 'How it works');
    fixture.componentRef.setInput('steps', [
      { title: 'Speak', description: 'Talk naturally.' },
      { title: 'Translate', description: 'Meaning, not words.' },
      { title: 'Connect', description: 'Heard aloud.' },
    ]);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    const steps = el.querySelectorAll('.step');
    expect(steps.length).toBe(3);
    expect(steps[0].textContent).toContain('Speak');
    expect(steps[0].querySelector('.step-index')?.textContent).toBe('1');
  });
});
