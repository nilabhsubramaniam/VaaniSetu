import { TestBed } from '@angular/core/testing';
import { GlobalNetwork } from './global-network';

describe('GlobalNetwork', () => {
  it('renders heading, description, and disclaimer text', () => {
    const fixture = TestBed.createComponent(GlobalNetwork);
    fixture.componentRef.setInput('heading', 'A growing network');
    fixture.componentRef.setInput('description', 'Every language matters.');
    fixture.componentRef.setInput('disclaimer', 'Illustrative only.');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('A growing network');
    expect(el.textContent).toContain('Every language matters.');
    expect(el.textContent).toContain('Illustrative only.');
  });
});
