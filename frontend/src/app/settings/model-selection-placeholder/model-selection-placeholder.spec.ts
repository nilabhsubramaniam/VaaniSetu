import { TestBed } from '@angular/core/testing';
import { ModelSelectionPlaceholder } from './model-selection-placeholder';

describe('ModelSelectionPlaceholder', () => {
  it('renders a disabled select — no model is selected yet (ADR-008)', () => {
    const fixture = TestBed.createComponent(ModelSelectionPlaceholder);
    fixture.detectChanges();

    const select = (fixture.nativeElement as HTMLElement).querySelector('select');
    expect(select).not.toBeNull();
    expect(select?.disabled).toBe(true);
  });
});
