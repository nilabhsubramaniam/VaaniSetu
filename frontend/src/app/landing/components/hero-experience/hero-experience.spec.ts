import { TestBed } from '@angular/core/testing';
import { HeroExperience } from './hero-experience';

describe('HeroExperience', () => {
  it('renders a language pill for every demo language node', () => {
    const fixture = TestBed.createComponent(HeroExperience);
    fixture.componentRef.setInput('selectedCode', 'en');
    fixture.detectChanges();

    const pills = (fixture.nativeElement as HTMLElement).querySelectorAll('.language-pill');
    expect(pills.length).toBe(fixture.componentInstance.demoLanguages.length);
  });

  it('emits nodeSelected when a pill is clicked', () => {
    const fixture = TestBed.createComponent(HeroExperience);
    fixture.componentRef.setInput('selectedCode', 'en');
    fixture.detectChanges();

    const emitted: string[] = [];
    fixture.componentInstance.nodeSelected.subscribe((code) => emitted.push(code));

    fixture.componentInstance.selectNode('hi');

    expect(emitted).toEqual(['hi']);
  });

  it('renders all four HUD phase legend rows', () => {
    const fixture = TestBed.createComponent(HeroExperience);
    fixture.componentRef.setInput('selectedCode', 'en');
    fixture.detectChanges();

    const rows = (fixture.nativeElement as HTMLElement).querySelectorAll('.legend-row');
    expect(rows.length).toBe(4);
  });
});
