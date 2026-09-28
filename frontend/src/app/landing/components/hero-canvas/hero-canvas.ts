import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  InjectionToken,
  NgZone,
  afterNextRender,
  effect,
  inject,
  input,
  output,
  viewChild,
  viewChildren,
} from '@angular/core';
import { findDemoLanguage } from '../../models/demo-language.model';
import type { HeroRegionNode } from '../../models/hero-region.model';
import type { DeviceTier, HeroScene } from '../../three/hero-scene';

type HeroSceneModule = typeof import('../../three/hero-scene');

/**
 * Loads `three/hero-scene.ts` — a real dynamic `import()` by default, so
 * `three` stays a separate lazy chunk that only downloads for visitors
 * who'll actually see it (`docs/DECISIONS.md`'s Three.js ADR). Provided
 * as an injectable factory, not a hardcoded call, purely so tests can
 * substitute a fake scene via `TestBed.overrideProvider` — Angular's
 * vitest integration doesn't support `vi.mock` for relative imports
 * (the same pattern this replaces, `INDIA_MAP_SCENE_LOADER`, already
 * proved this out).
 */
export const HERO_SCENE_LOADER = new InjectionToken<() => Promise<HeroSceneModule>>(
  'HERO_SCENE_LOADER',
  { factory: () => () => import('../../three/hero-scene') },
);

/**
 * Owns the `<canvas>` for the hero's unified Three.js scene
 * (`three/hero-scene.ts`), its render loop, and the real DOM
 * language-node chips the scene positions every frame (a 3D world
 * position projected to CSS pixels via `projectToScreen`, written
 * directly onto each chip's `style.transform` — bypassing Angular
 * change detection for per-frame updates, the one technique revived
 * from the old, removed hero's `project-to-screen.ts`;
 * `docs/DECISIONS.md`'s Three.js ADR). The chips are decorative
 * (`tabindex="-1"`, `aria-hidden`) — `.language-node-list` further down
 * `landing.page.html` remains the one real, keyboard-accessible control.
 *
 * Only ever mounted by the parent when `landing.page.ts`'s own
 * capability gate (`supportsWebGL() && !prefersReducedMotion()`,
 * `three/environment-support.ts`) already passed — this component
 * doesn't re-check either.
 */
@Component({
  selector: 'app-hero-canvas',
  templateUrl: './hero-canvas.html',
  styleUrl: './hero-canvas.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroCanvas {
  readonly heroRegions = input.required<readonly HeroRegionNode[]>();
  /** Same signal `landing.page.ts`'s DOM region list already drives —
   * this component just reflects it for the hover-highlight, it's not a
   * second source of truth. */
  readonly selectedRegion = input<string | null>(null);
  readonly isMicDemoActive = input(false);
  readonly deviceTier = input<DeviceTier>('full');

  /** Emitted (decorative only) when a projected node is hovered/
   * unhovered, in case the real list below wants to mirror the
   * highlight — never required for the real control to work. */
  readonly regionHover = output<string | null>();

  readonly demoLanguage = findDemoLanguage;

  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly chipRefs = viewChildren<ElementRef<HTMLElement>>('nodeChip');
  private readonly destroyRef = inject(DestroyRef);
  private readonly zone = inject(NgZone);
  private readonly loadScene = inject(HERO_SCENE_LOADER);

  private scene: HeroScene | undefined;
  private frameHandle: number | undefined;
  private resizeObserver: ResizeObserver | undefined;
  private lastFrameTime = 0;
  private lastHovered: string | null = null;
  private pointer = { x: 0, y: 0 };

  constructor() {
    afterNextRender(() => void this.mount());

    effect(() => {
      this.scene?.setMicActive(this.isMicDemoActive());
    });

    this.destroyRef.onDestroy(() => this.teardown());
  }

  onPointerMove(event: PointerEvent): void {
    const canvas = this.canvasRef().nativeElement;
    const rect = canvas.getBoundingClientRect();
    this.pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  onPointerLeave(): void {
    this.scene?.setPointer(0, 0);
  }

  private async mount(): Promise<void> {
    const canvas = this.canvasRef().nativeElement;
    const { width, height } = canvas.getBoundingClientRect();

    const { HeroScene } = await this.loadScene();
    const scene = new HeroScene(
      canvas,
      Math.max(width, 1),
      Math.max(height, 1),
      this.heroRegions(),
      this.deviceTier(),
    );
    this.scene = scene;
    scene.setMicActive(this.isMicDemoActive());

    this.resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      scene.resize(Math.max(entry.contentRect.width, 1), Math.max(entry.contentRect.height, 1));
    });
    this.resizeObserver.observe(canvas);

    // The render loop, chip position writes, and hover hit-testing all
    // run outside Angular's zone — none of it should trigger change
    // detection every frame.
    this.zone.runOutsideAngular(() => {
      this.lastFrameTime = performance.now();
      const loop = (time: number) => {
        // Clamped to >= 0: a rAF callback's own timestamp can precede the
        // performance.now() captured just before scheduling it (a real,
        // browser-observed first-frame quirk, not a hypothetical one —
        // found live via Playwright: elapsed went negative, which then
        // made HeroScene's curve-parameter math index connection-path
        // points with a negative array index and crash).
        const deltaSeconds = Math.max(0, (time - this.lastFrameTime) / 1000);
        this.lastFrameTime = time;

        const rect = canvas.getBoundingClientRect();
        const nx = rect.width > 0 ? (this.pointer.x / rect.width) * 2 - 1 : 0;
        const ny = rect.height > 0 ? (this.pointer.y / rect.height) * 2 - 1 : 0;
        scene.setPointer(nx, ny);

        const hovered = scene.hitTest(this.pointer.x, this.pointer.y);
        if (hovered !== this.lastHovered) {
          this.lastHovered = hovered;
          scene.setHovered(hovered);
          this.regionHover.emit(hovered);
        }

        scene.update(deltaSeconds);
        this.writeChipPositions(scene);

        this.frameHandle = requestAnimationFrame(loop);
      };
      this.frameHandle = requestAnimationFrame(loop);
    });
  }

  private writeChipPositions(scene: HeroScene): void {
    const chips = this.chipRefs();
    for (const position of scene.projectedNodePositions()) {
      const chip = chips.find((c) => c.nativeElement.dataset['code'] === position.code);
      if (!chip) continue;
      const el = chip.nativeElement;
      el.style.transform = `translate(-50%, -50%) translate(${position.x}px, ${position.y}px)`;
      el.style.opacity = position.visible ? '1' : '0';
    }
  }

  private teardown(): void {
    if (this.frameHandle !== undefined) {
      cancelAnimationFrame(this.frameHandle);
    }
    this.resizeObserver?.disconnect();
    this.scene?.dispose();
  }
}
