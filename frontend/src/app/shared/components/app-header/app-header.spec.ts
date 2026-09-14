import { provideRouter } from '@angular/router';
import { TestBed } from '@angular/core/testing';
import { AppHeader } from './app-header';

describe('AppHeader', () => {
  beforeEach(() => {
    localStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
  });

  it('renders the brand, both nav links, and the language selector', () => {
    const fixture = TestBed.createComponent(AppHeader);
    fixture.detectChanges();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('VaaniSetu');
    expect(el.querySelector('a[href="/assistant"]')).not.toBeNull();
    expect(el.querySelector('a[href="/settings"]')).not.toBeNull();
    expect(el.querySelector('app-language-selector')).not.toBeNull();
  });

  it('brand links to the home route', () => {
    const fixture = TestBed.createComponent(AppHeader);
    fixture.detectChanges();

    const brand = (fixture.nativeElement as HTMLElement).querySelector('.brand');
    expect(brand?.getAttribute('href')).toBe('/');
  });
});
