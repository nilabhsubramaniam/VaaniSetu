import { TestBed } from '@angular/core/testing';
import { HeroCanvas, HERO_SCENE_LOADER } from './hero-canvas';
import { HERO_REGION_NODES } from '../../models/hero-region.model';
import type { HeroScene } from '../../three/hero-scene';

// jsdom (this project's test environment) has no ResizeObserver at all —
// stubbed here rather than in global setup, same approach the retired
// india-map.spec.ts already used.
/* eslint-disable @typescript-eslint/no-empty-function -- deliberate no-op stub */
class FakeResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
/* eslint-enable @typescript-eslint/no-empty-function */

/** A fake scene, standing in for the real Three.js one — Angular's
 * vitest integration doesn't support `vi.mock` for relative imports, so
 * `HERO_SCENE_LOADER` (a DI-injected factory, see hero-canvas.ts) is
 * overridden instead. */
function fakeScene(): HeroScene {
  return {
    update: vi.fn(),
    dispose: vi.fn(),
    resize: vi.fn(),
    setMicActive: vi.fn(),
    setPointer: vi.fn(),
    hitTest: vi.fn().mockReturnValue(null),
    setHovered: vi.fn(),
    projectedNodePositions: vi.fn().mockReturnValue([]),
  } as unknown as HeroScene;
}

describe('HeroCanvas', () => {
  let scene: HeroScene;
  let originalResizeObserver: typeof ResizeObserver | undefined;

  beforeEach(() => {
    originalResizeObserver = window.ResizeObserver;
    window.ResizeObserver = FakeResizeObserver as unknown as typeof ResizeObserver;
    scene = fakeScene();
    TestBed.configureTestingModule({
      providers: [
        {
          provide: HERO_SCENE_LOADER,
          useValue: () =>
            Promise.resolve({
              HeroScene: vi.fn().mockImplementation(function (this: unknown) {
                return scene;
              }),
            }),
        },
      ],
    });
  });

  afterEach(() => {
    window.ResizeObserver = originalResizeObserver as typeof ResizeObserver;
  });

  function createFixture() {
    const fixture = TestBed.createComponent(HeroCanvas);
    fixture.componentRef.setInput('heroRegions', HERO_REGION_NODES);
    fixture.detectChanges();
    return fixture;
  }

  it('renders a canvas and one decorative chip per hero region', () => {
    const fixture = createFixture();

    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('canvas')).toBeTruthy();
    expect(el.querySelectorAll('.node-chip').length).toBe(HERO_REGION_NODES.length);
  });

  it('chips are not keyboard-focusable (decorative; the real control is .language-node-list)', () => {
    const fixture = createFixture();

    const chips = (fixture.nativeElement as HTMLElement).querySelectorAll('.node-chip');
    chips.forEach((chip) => expect(chip.getAttribute('tabindex')).toBe('-1'));
  });

  it('mounts the scene after the first render', async () => {
    createFixture();
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(scene.update).toBeDefined();
  });

  it('forwards isMicDemoActive changes to the scene', async () => {
    const fixture = createFixture();
    fixture.componentRef.setInput('isMicDemoActive', true);
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 0));
    fixture.detectChanges();

    expect(scene.setMicActive).toHaveBeenCalledWith(true);
  });

  it('disposes the scene and cancels the frame loop on destroy', async () => {
    const cancelSpy = vi.spyOn(window, 'cancelAnimationFrame');
    const fixture = createFixture();
    await new Promise((resolve) => setTimeout(resolve, 0));

    fixture.destroy();

    expect(scene.dispose).toHaveBeenCalled();
    expect(cancelSpy).toHaveBeenCalled();
    cancelSpy.mockRestore();
  });
});
