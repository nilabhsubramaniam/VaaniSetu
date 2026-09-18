import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  viewChild,
} from '@angular/core';
// Type-only: erased at compile time, so this doesn't pull `three` into any
// eagerly-loaded bundle — only the `await import('three')` below does
// that, and only once a visitor actually needs the real scene (see
// ngAfterViewInit).
import type { BufferAttribute, Vector3 } from 'three';
import { heroStoryStageWeights } from '../hero-story-progress';

/**
 * The landing page's hero visual: a central faceted core inside a small
 * armillary-sphere-like assembly of tilted rings, with a field of fine
 * particles drifting, converging, and dispersing around it — rendered
 * with Three.js, and choreographed by the same `progress` value that
 * drives the hero's caption overlay (see landing.page.ts and
 * ../hero-story-progress.ts), so the visual and the text are always
 * telling the same moment of the listen → process → think → respond
 * story.
 *
 * The ring-mechanism silhouette is a deliberate nod to armillary
 * spheres/yantra instruments (the Jantar Mantar observatories are the
 * clearest example) — a tasteful, non-literal way to carry an Indian
 * visual lineage in the product's core identity rather than only in a
 * language-pills list further down the page.
 *
 * Deliberately its own component, not inline in LandingPage, for two
 * reasons neither shared with why the rest of the landing page stays one
 * component (see landing.page.ts's own doc comment): this owns real
 * lifecycle (a WebGL context, a render loop, event listeners) that needs
 * its own cleanup, and it needs to be its own file so `@defer` in the
 * host template can code-split it — and everything it imports, including
 * `three` itself — into a separate chunk that never blocks the landing
 * page's first paint or ships to any other route.
 *
 * Progressive enhancement, not a hard dependency: the host template
 * keeps a hand-drawn SVG motif underneath this component at all times.
 * If WebGL isn't available, or the visitor has `prefers-reduced-motion`
 * set, this component never draws anything — its canvas stays fully
 * transparent — and the SVG motif remains the complete, finished visual
 * with no separate fallback path to maintain.
 */
@Component({
  selector: 'app-hero-scene',
  templateUrl: './hero-scene.html',
  styleUrl: './hero-scene.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroScene implements AfterViewInit {
  private readonly canvasRef = viewChild.required<ElementRef<HTMLCanvasElement>>('canvas');
  private readonly hostRef = inject(ElementRef<HTMLElement>);
  private readonly destroyRef = inject(DestroyRef);

  /** 0..1 across the whole scroll-driven story — see
   * ../hero-story-progress.ts. Read fresh every frame, not reacted to via
   * an Angular effect, since the render loop already runs every frame
   * regardless. */
  readonly progress = input<number>(0);

  private animationHandle?: number;
  private isInView = true;
  private disposed = false;

  async ngAfterViewInit(): Promise<void> {
    if (this.prefersReducedMotion() || !this.supportsWebGL()) {
      return;
    }

    // `three` only ever loads for a visitor who'll actually see it drawn
    // — `@defer` on the host already keeps it out of the landing page's
    // initial bundle; this dynamic import keeps it out of every other
    // route's bundle too.
    const THREE = await import('three');
    if (this.disposed) {
      return; // destroyed while the import was still in flight
    }
    this.setupScene(THREE);
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof window !== 'undefined' &&
      !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    );
  }

  private supportsWebGL(): boolean {
    if (typeof document === 'undefined') {
      return false;
    }
    try {
      const canvas = document.createElement('canvas');
      return !!(canvas.getContext('webgl2') || canvas.getContext('webgl'));
    } catch {
      return false;
    }
  }

  private readCssColor(varName: string, fallback: string): string {
    const value = getComputedStyle(this.hostRef.nativeElement).getPropertyValue(varName).trim();
    return value || fallback;
  }

  private setupScene(THREE: typeof import('three')): void {
    const canvas = this.canvasRef().nativeElement;
    const host = this.hostRef.nativeElement;

    // Reads --cinema-accent/--cinema-accent-soft, defined on the
    // ancestor .hero-story (landing.page.scss) — a fixed palette that
    // does NOT flip with the site's light/dark theme, because the hero
    // deliberately stays a dark, cinematic stage regardless of it. The
    // fallbacks here match those tokens' own values.
    const accent = this.readCssColor('--cinema-accent', '#52c0a0');
    const accentSoft = this.readCssColor('--cinema-accent-soft', '#7fb3ee');

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100);
    camera.position.set(0, 0, 7);

    const renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

    // The core: a low-poly faceted icosahedron — a faint solid fill plus
    // a brighter wireframe overlay, both unlit (MeshBasicMaterial) so the
    // look stays flat and deliberate. No lights, no shadows, no
    // post-processing — cheap to render and true to "premium, not a
    // demo-reel effect".
    const coreGeometry = new THREE.IcosahedronGeometry(1.15, 1);
    const coreFillMaterial = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.08,
    });
    const coreEdgeMaterial = new THREE.LineBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.6,
    });
    const core = new THREE.Group();
    core.add(new THREE.Mesh(coreGeometry, coreFillMaterial));
    core.add(new THREE.LineSegments(new THREE.EdgesGeometry(coreGeometry), coreEdgeMaterial));
    scene.add(core);

    // The armillary rings — thin wireframe circles (not filled bands),
    // each tilted on its own axis, each rotating at its own base speed.
    // "Process" spins them up further; see stageBlend() in the render
    // loop below.
    const ringRadii = [1.9, 2.5, 3.1];
    const ringTilts = [
      { x: Math.PI / 2 + 0.15, y: 0, z: 0.1 },
      { x: Math.PI / 2 - 0.3, y: 0.4, z: 0 },
      { x: Math.PI / 2 + 0.45, y: -0.35, z: 0.2 },
    ];
    const ringBaseSpeeds = [0.05, -0.035, 0.025];
    const rings = ringRadii.map((radius, i) => {
      const points: Vector3[] = [];
      const segments = 128;
      for (let s = 0; s <= segments; s++) {
        const a = (s / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(a) * radius, Math.sin(a) * radius, 0));
      }
      const ring = new THREE.LineLoop(
        new THREE.BufferGeometry().setFromPoints(points),
        new THREE.LineBasicMaterial({ color: accent, transparent: true, opacity: 0.35 }),
      );
      ring.rotation.set(ringTilts[i].x, ringTilts[i].y, ringTilts[i].z);
      scene.add(ring);
      return ring;
    });

    // Small marker nodes at fixed intervals along each ring — calibration
    // marks on the instrument, not free-orbiting satellites: they rotate
    // WITH their ring (as children of it), not independently around it.
    const markerGeometry = new THREE.IcosahedronGeometry(0.045, 0);
    const markerMaterial = new THREE.MeshBasicMaterial({ color: accentSoft });
    rings.forEach((ring, i) => {
      const markerCount = 4;
      for (let m = 0; m < markerCount; m++) {
        const a = (m / markerCount) * Math.PI * 2 + i; // offset per ring so they don't all align
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.set(Math.cos(a) * ringRadii[i], Math.sin(a) * ringRadii[i], 0);
        ring.add(marker);
      }
    });

    // The particle field: drifts gently at rest, converges toward the
    // core during "process" (speech becoming data), and disperses
    // outward during "respond" (the reply going back out) — see
    // stageBlend() below. Plain THREE.Points, no physics: each particle's
    // current radius is just its own base radius scaled by one number
    // that the render loop updates every frame.
    const particleCount = 260;
    const particleBaseRadius = new Float32Array(particleCount);
    const particleAngle = new Float32Array(particleCount);
    const particleTilt = new Float32Array(particleCount);
    const particlePositions = new Float32Array(particleCount * 3);
    for (let p = 0; p < particleCount; p++) {
      particleBaseRadius[p] = 1.6 + Math.random() * 2.2;
      particleAngle[p] = Math.random() * Math.PI * 2;
      particleTilt[p] = (Math.random() - 0.5) * Math.PI;
    }
    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particles = new THREE.Points(
      particleGeometry,
      new THREE.PointsMaterial({
        color: accentSoft,
        size: 0.035,
        transparent: true,
        opacity: 0.55,
        sizeAttenuation: true,
      }),
    );
    scene.add(particles);

    const clock = new THREE.Clock();
    const pointerTarget = { x: 0, y: 0 };
    const pointerCurrent = { x: 0, y: 0 };

    // Pointer parallax only for pointer devices — never attached for
    // touch, so it can't interfere with scrolling, and there is no
    // keyboard interaction to support since the canvas is purely
    // decorative (aria-hidden, not focusable).
    const supportsHover =
      typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: fine)').matches;

    const onPointerMove = (event: PointerEvent) => {
      const rect = host.getBoundingClientRect();
      pointerTarget.x = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
      pointerTarget.y = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };
    const onPointerLeave = () => {
      pointerTarget.x = 0;
      pointerTarget.y = 0;
    };
    if (supportsHover) {
      host.addEventListener('pointermove', onPointerMove);
      host.addEventListener('pointerleave', onPointerLeave);
    }

    const resize = () => {
      const { width, height } = host.getBoundingClientRect();
      if (width === 0 || height === 0) {
        return;
      }
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height, false);
    };
    resize();

    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);

    // Same "pause when off-screen" idea as shared/directives/reveal-on-scroll.directive.ts
    // — here to save CPU/GPU/battery on a long scroll, not to trigger a
    // one-time reveal.
    const intersectionObserver = new IntersectionObserver(
      ([entry]) => {
        this.isInView = entry.isIntersecting;
      },
      { threshold: 0 },
    );
    intersectionObserver.observe(host);

    const render = () => {
      this.animationHandle = requestAnimationFrame(render);
      if (!this.isInView || document.hidden) {
        return;
      }

      const elapsed = clock.getElapsedTime();
      const [listen, process, think, respond] = heroStoryStageWeights(this.progress());

      // Idle rotation, always present, gently accelerated by "process".
      const ringSpeedScale = 1 + process * 3.2;
      rings.forEach((ring, i) => {
        ring.rotation.z += ringBaseSpeeds[i] * ringSpeedScale * 0.016;
      });
      core.rotation.y = elapsed * 0.08;
      core.rotation.x = elapsed * 0.03;

      // "Listen": a slow pulse on the core's edge brightness, standing in
      // for a waveform breathing with incoming speech.
      const listenPulse = 0.5 + 0.5 * Math.sin(elapsed * 2.4);
      coreEdgeMaterial.opacity = 0.45 + listen * listenPulse * 0.25;

      // "Think": the core's fill brightens, as if lighting up from
      // within while it reasons.
      coreFillMaterial.opacity = 0.08 + think * 0.22;

      // Particles: converge during "process" (speech becoming data),
      // drift near their resting radius otherwise, disperse outward
      // during "respond" (the reply going back out).
      const radiusScale = 1 - process * 0.55 + respond * 0.9;
      const positions = particleGeometry.attributes['position'] as BufferAttribute;
      for (let p = 0; p < particleCount; p++) {
        const drift = elapsed * 0.05 + p;
        const radius = particleBaseRadius[p] * radiusScale;
        const angle = particleAngle[p] + drift * 0.1;
        const tilt = particleTilt[p];
        positions.setXYZ(
          p,
          Math.cos(angle) * radius * Math.cos(tilt),
          Math.sin(tilt) * radius,
          Math.sin(angle) * radius * Math.cos(tilt),
        );
      }
      positions.needsUpdate = true;

      // Smoothed, never snapping straight to the pointer.
      pointerCurrent.x += (pointerTarget.x - pointerCurrent.x) * 0.04;
      pointerCurrent.y += (pointerTarget.y - pointerCurrent.y) * 0.04;
      scene.rotation.y = pointerCurrent.x * 0.2;
      scene.rotation.x = -pointerCurrent.y * 0.12;

      renderer.render(scene, camera);
    };
    this.animationHandle = requestAnimationFrame(render);

    this.destroyRef.onDestroy(() => {
      this.disposed = true;
      if (this.animationHandle !== undefined) {
        cancelAnimationFrame(this.animationHandle);
      }
      resizeObserver.disconnect();
      intersectionObserver.disconnect();
      if (supportsHover) {
        host.removeEventListener('pointermove', onPointerMove);
        host.removeEventListener('pointerleave', onPointerLeave);
      }
      // WebGL contexts are a scarce, browser-capped resource — dispose
      // every geometry/material plus the renderer itself so navigating
      // away from and back to this page never leaks one.
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
          obj.geometry.dispose();
          const material = obj.material;
          if (Array.isArray(material)) {
            material.forEach((m) => m.dispose());
          } else {
            material.dispose();
          }
        } else if (obj instanceof THREE.LineLoop || obj instanceof THREE.Points) {
          obj.geometry.dispose();
          const material = obj.material;
          if (Array.isArray(material)) {
            material.forEach((m) => m.dispose());
          } else {
            material.dispose();
          }
        }
      });
      renderer.dispose();
    });
  }
}
