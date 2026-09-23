import { TestBed } from '@angular/core/testing';
import { TextTransformDemo } from './text-transform-demo';

describe('TextTransformDemo', () => {
  it('renders the heading, description, source, and target text', () => {
    const fixture = TestBed.createComponent(TextTransformDemo);
    fixture.componentRef.setInput('heading', 'Say it once');
    fixture.componentRef.setInput('description', 'Understood everywhere');
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Say it once');
    expect(el.textContent).toContain('Understood everywhere');
    expect(el.textContent).toContain('नमस्ते');
    expect(el.textContent).toContain('Hello');
  });
});
