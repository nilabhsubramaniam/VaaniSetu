import { TestBed } from '@angular/core/testing';
import { StatusPill } from './status-pill';

describe('StatusPill', () => {
  it('renders the given label', () => {
    const fixture = TestBed.createComponent(StatusPill);
    fixture.componentRef.setInput('label', 'Listening');
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Listening');
  });

  it('defaults to the neutral tone and reflects a given tone via data-tone', () => {
    const fixture = TestBed.createComponent(StatusPill);
    fixture.componentRef.setInput('label', 'Hindi');
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.pill')?.getAttribute('data-tone'),
    ).toBe('neutral');

    fixture.componentRef.setInput('tone', 'error');
    fixture.detectChanges();
    expect(
      (fixture.nativeElement as HTMLElement).querySelector('.pill')?.getAttribute('data-tone'),
    ).toBe('error');
  });
});
