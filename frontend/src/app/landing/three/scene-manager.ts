import { Fog, PerspectiveCamera, Scene, WebGLRenderer } from 'three';

export interface SceneManagerOptions {
  readonly canvas: HTMLCanvasElement;
  readonly alpha?: boolean;
  readonly cameraFov?: number;
  readonly cameraPosition?: readonly [number, number, number];
  readonly fogColor?: string;
  readonly fogNear?: number;
  readonly fogFar?: number;
}

export type PerformanceTier = 'full' | 'reduced';

/**
 * Judges how much visual complexity the hero scene should render, based on
 * the device rather than a fixed guess — a low core count or a narrow
 * viewport gets the lighter particle/geometry counts used throughout
 * `core-system.ts` and `hero-runtime.ts`.
 */
export function computePerformanceTier(): PerformanceTier {
  if (typeof window === 'undefined') return 'reduced';
  const prefersReducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const narrowViewport = window.innerWidth < 720;
  const lowCoreCount = (navigator.hardwareConcurrency ?? 8) <= 4;
  return prefersReducedMotion || narrowViewport || lowCoreCount ? 'reduced' : 'full';
}

/**
 * Owns the renderer/camera/scene lifecycle: resize handling via
 * `ResizeObserver`, and pausing the render loop via `IntersectionObserver`
 * when the canvas scrolls out of view, so the hero doesn't burn frames once
 * the visitor has scrolled past it.
 */
export class SceneManager {
  readonly scene = new Scene();
  readonly camera: PerspectiveCamera;
  readonly renderer: WebGLRenderer;

  private frameHandle: number | null = null;
  private lastTime = 0;
  private isVisible = true;
  private onFrameCallback: ((delta: number, elapsed: number) => void) | null = null;
  private readonly resizeObserver: ResizeObserver;
  private readonly intersectionObserver: IntersectionObserver;
  private elapsed = 0;

  constructor(private readonly options: SceneManagerOptions) {
    const { canvas, alpha = true, cameraFov = 45, cameraPosition = [0, 0, 8] } = options;

    this.camera = new PerspectiveCamera(cameraFov, 1, 0.1, 100);
    this.camera.position.set(...cameraPosition);

    this.renderer = new WebGLRenderer({ canvas, alpha, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

    if (options.fogColor) {
      this.scene.fog = new Fog(options.fogColor, options.fogNear ?? 8, options.fogFar ?? 20);
    }

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(canvas);
    this.handleResize();

    this.intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        this.isVisible = entry?.isIntersecting ?? true;
      },
      { threshold: 0 },
    );
    this.intersectionObserver.observe(canvas);
  }

  onFrame(callback: (delta: number, elapsed: number) => void): void {
    this.onFrameCallback = callback;
  }

  start(): void {
    this.lastTime = performance.now();
    const tick = (time: number) => {
      const delta = Math.min((time - this.lastTime) / 1000, 0.1);
      this.lastTime = time;
      this.elapsed += delta;

      if (this.isVisible) {
        this.onFrameCallback?.(delta, this.elapsed);
        this.renderer.render(this.scene, this.camera);
      }

      this.frameHandle = requestAnimationFrame(tick);
    };
    this.frameHandle = requestAnimationFrame(tick);
  }

  dispose(): void {
    if (this.frameHandle !== null) cancelAnimationFrame(this.frameHandle);
    this.resizeObserver.disconnect();
    this.intersectionObserver.disconnect();
    this.renderer.dispose();
  }

  private handleResize(): void {
    const { canvas } = this.options;
    const width = canvas.clientWidth || 1;
    const height = canvas.clientHeight || 1;
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
  }
}
