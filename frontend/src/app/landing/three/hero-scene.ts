import {
  AmbientLight,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CatmullRomCurve3,
  CylinderGeometry,
  Group,
  LineBasicMaterial,
  LineLoop,
  Mesh,
  MeshPhysicalMaterial,
  PerspectiveCamera,
  PointLight,
  Points,
  PointsMaterial,
  RingGeometry,
  Scene,
  TorusGeometry,
  TubeGeometry,
  Vector3,
  WebGLRenderer,
} from 'three';
import { INDIA_OUTLINE, INDIA_REGION_POSITIONS } from './india-outline-data';
import { readCssColor } from './read-css-color';
import { projectToScreen } from './project-to-screen';
import type { HeroRegionNode } from '../models/hero-region.model';

export type DeviceTier = 'full' | 'reduced';

/** Exported for `hero-scene.spec.ts` — pure lookups, no renderer needed
 * to test that narrower viewports genuinely get less geometry. */
export const RING_COUNT_BY_TIER: Record<DeviceTier, number> = { full: 3, reduced: 2 };
export const PARTICLE_COUNT_BY_TIER: Record<DeviceTier, number> = { full: 220, reduced: 90 };

const MAP_TILT_X = -0.5; // radians, tilts the India plane away from camera
const MAP_Z_OFFSET = -2.4;
const MAP_SCALE = 1.15;
const MIC_RING_BASE_RADIUS = 0.55;
const MAX_PARALLAX = 0.35;
const HOVER_RADIUS_PX = 42;

interface NodeRuntime {
  readonly code: string;
  readonly worldPosition: Vector3;
  readonly curve: CatmullRomCurve3;
  readonly particle: Points;
}

/** Builds one connection path's curve: a slight upward bow at the
 * midpoint, not a straight line — reads as a "communication arc," not a
 * literal wire. Pure (no renderer/scene needed), so this is directly
 * unit-testable, unlike the class constructor that uses it. */
export function buildConnectionCurve(from: Vector3, to: Vector3, lift: number): CatmullRomCurve3 {
  const mid = new Vector3().lerpVectors(from, to, 0.5);
  mid.y += lift;
  return new CatmullRomCurve3([from.clone(), mid, to.clone()]);
}

/** A grille-dot pattern generated at runtime on a `<canvas>` — no image
 * asset — used as the mic head's alpha map so it reads as a real mic
 * grille rather than a plain metal cap. */
function createGrilleTexture(): CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#fff';
  const step = 10;
  for (let y = step / 2; y < size; y += step) {
    for (let x = step / 2; x < size; x += step) {
      ctx.beginPath();
      ctx.arc(x, y, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

/**
 * The hero's unified scene: a procedural 3D microphone, the real India
 * outline (`india-outline-data.ts`) tilted back as a "console surface,"
 * animated connection paths from the mic to each hero region with a
 * traveling particle, a handful of ambient particles, and subtle
 * pointer-driven camera parallax. Replaces the separate flat map scene
 * (`docs/DECISIONS.md`'s Three.js ADR and this file's own predecessor,
 * `india-map-scene.ts`, folded in here) and the hero's old flat CSS mic.
 *
 * Language-node labels are real DOM chips positioned by
 * `projectedNodePositions()` every frame, not canvas text — selecting a
 * language never depends on this scene; `.language-node-list` remains
 * the one real, keyboard-accessible control (`docs/DECISIONS.md` ADR-019's
 * reasoning for real DOM over 3D pick targets, unchanged).
 */
export class HeroScene {
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera: PerspectiveCamera;
  private readonly mapGroup = new Group();
  private readonly micGroup = new Group();
  private readonly outlineMaterial: LineBasicMaterial;
  private readonly markerMaterial: PointsMaterial;
  private readonly ambientParticles: Points;
  private readonly ambientMaterial: PointsMaterial;
  private readonly ringMaterials: MeshPhysicalMaterial[] = [];
  private readonly rings: Mesh[] = [];
  private readonly nodes: NodeRuntime[] = [];
  private readonly cameraBase = new Vector3(0, 0.4, 6);
  private readonly tier: DeviceTier;

  private width: number;
  private height: number;
  private elapsed = 0;
  private micActive = false;
  private hoveredCode: string | null = null;
  private pointerTarget = { x: 0, y: 0 };
  private pointerCurrent = { x: 0, y: 0 };

  constructor(
    canvas: HTMLCanvasElement,
    width: number,
    height: number,
    regions: readonly HeroRegionNode[],
    tier: DeviceTier,
  ) {
    this.tier = tier;
    this.width = Math.max(width, 1);
    this.height = Math.max(height, 1);

    this.renderer = new WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setClearColor(0x0a0d12, 1);
    this.renderer.setSize(this.width, this.height, false);

    this.camera = new PerspectiveCamera(48, this.width / this.height, 0.1, 30);
    this.camera.position.copy(this.cameraBase);
    this.camera.lookAt(0, 0, 0);

    const cyan = readCssColor('--vs-cyan', '#3f96b0');
    const gold = readCssColor('--vs-gold', '#b9812e');
    const violet = readCssColor('--vs-violet', '#5b4b8a');

    this.scene.add(new AmbientLight(0xffffff, 0.35));
    const keyLight = new PointLight(cyan, 6, 12);
    keyLight.position.set(1.5, 2, 3);
    this.scene.add(keyLight);
    const rimLight = new PointLight(gold, 4, 10);
    rimLight.position.set(-1.5, -1, 2);
    this.scene.add(rimLight);

    // ---- microphone: body + grille + base platform + sound-wave rings ----
    const bodyMaterial = new MeshPhysicalMaterial({
      color: 0x9aa4b2,
      metalness: 0.9,
      roughness: 0.28,
      emissive: cyan,
      emissiveIntensity: 0.12,
    });
    const body = new Mesh(new CylinderGeometry(0.26, 0.3, 0.5, 24), bodyMaterial);
    this.micGroup.add(body);

    const grille = new Mesh(
      new CylinderGeometry(0.27, 0.27, 0.08, 24),
      new MeshPhysicalMaterial({
        color: 0xd8dee8,
        metalness: 0.7,
        roughness: 0.4,
        alphaMap: createGrilleTexture(),
        transparent: true,
        emissive: cyan,
        emissiveIntensity: 0.25,
      }),
    );
    grille.position.y = 0.32;
    this.micGroup.add(grille);

    const platform = new Mesh(
      new RingGeometry(MIC_RING_BASE_RADIUS * 0.75, MIC_RING_BASE_RADIUS, 48),
      new MeshPhysicalMaterial({
        color: 0x1a2030,
        metalness: 0.6,
        roughness: 0.5,
        emissive: cyan,
        emissiveIntensity: 0.3,
        transparent: true,
        opacity: 0.85,
      }),
    );
    platform.rotation.x = -Math.PI / 2;
    platform.position.y = -0.32;
    this.micGroup.add(platform);

    const ringSegments = this.tier === 'full' ? 48 : 24;
    for (let i = 0; i < RING_COUNT_BY_TIER[this.tier]; i++) {
      const ringMaterial = new MeshPhysicalMaterial({
        color: cyan,
        emissive: cyan,
        emissiveIntensity: 1,
        transparent: true,
        opacity: 0.5,
      });
      const ring = new Mesh(
        new TorusGeometry(MIC_RING_BASE_RADIUS * 0.9, 0.01, 8, ringSegments),
        ringMaterial,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = -0.32;
      this.ringMaterials.push(ringMaterial);
      this.rings.push(ring);
      this.micGroup.add(ring);
    }

    this.scene.add(this.micGroup);

    // ---- ambient particles ----
    const particleCount = PARTICLE_COUNT_BY_TIER[this.tier];
    const particlePositions = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 8;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 5;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 6 - 1;
    }
    const particleGeometry = new BufferGeometry();
    particleGeometry.setAttribute('position', new BufferAttribute(particlePositions, 3));
    this.ambientMaterial = new PointsMaterial({
      color: violet,
      size: 0.02,
      transparent: true,
      opacity: 0.5,
      sizeAttenuation: true,
    });
    this.ambientParticles = new Points(particleGeometry, this.ambientMaterial);
    this.scene.add(this.ambientParticles);

    // ---- India outline, tilted back as a console surface ----
    this.mapGroup.position.set(0, -0.9, MAP_Z_OFFSET);
    this.mapGroup.rotation.x = MAP_TILT_X;
    this.mapGroup.scale.setScalar(MAP_SCALE);

    this.outlineMaterial = new LineBasicMaterial({ color: cyan, transparent: true, opacity: 0.7 });
    const outlineGeometry = new BufferGeometry().setFromPoints(
      INDIA_OUTLINE.map(([x, y]) => new Vector3(x, y, 0)),
    );
    this.mapGroup.add(new LineLoop(outlineGeometry, this.outlineMaterial));

    const regionCodes = regions.map((r) => r.languageCode);
    const markerPositions = new Float32Array(regionCodes.length * 3);
    regionCodes.forEach((code, i) => {
      const [x, y] = INDIA_REGION_POSITIONS[code];
      markerPositions.set([x, y, regions[i].depth], i * 3);
    });
    const markerGeometry = new BufferGeometry();
    markerGeometry.setAttribute('position', new BufferAttribute(markerPositions, 3));
    this.markerMaterial = new PointsMaterial({
      color: gold,
      size: 0.1,
      transparent: true,
      opacity: 0.95,
      sizeAttenuation: false,
    });
    this.mapGroup.add(new Points(markerGeometry, this.markerMaterial));

    this.scene.add(this.mapGroup);

    // ---- connection paths: mic (world origin) -> each region marker ----
    const micOrigin = new Vector3(0, 0.1, 0);
    regions.forEach((region) => {
      const [x, y] = INDIA_REGION_POSITIONS[region.languageCode];
      const worldPoint = this.mapGroup.localToWorld(new Vector3(x, y, region.depth));

      const curve = buildConnectionCurve(micOrigin, worldPoint, 0.6);

      const tubeSegments = this.tier === 'full' ? 40 : 20;
      const tubeGeometry = new TubeGeometry(curve, tubeSegments, 0.006, 6, false);
      this.scene.add(
        new Mesh(
          tubeGeometry,
          new MeshPhysicalMaterial({
            color: cyan,
            emissive: cyan,
            emissiveIntensity: 0.8,
            transparent: true,
            opacity: 0.35,
          }),
        ),
      );

      const particleGeometry = new BufferGeometry();
      particleGeometry.setAttribute('position', new BufferAttribute(new Float32Array(3), 3));
      const particle = new Points(
        particleGeometry,
        new PointsMaterial({
          color: gold,
          size: 0.06,
          transparent: true,
          opacity: 0.9,
          sizeAttenuation: false,
        }),
      );
      this.scene.add(particle);

      this.nodes.push({ code: region.languageCode, worldPosition: worldPoint, curve, particle });
    });
  }

  setMicActive(active: boolean): void {
    this.micActive = active;
  }

  /** Normalized pointer position (-1..1 on each axis) for the subtle
   * camera parallax — always lerped toward in `update()`, never applied
   * instantly, per the brief's own "avoid nausea" instruction. */
  setPointer(nx: number, ny: number): void {
    this.pointerTarget = { x: nx, y: ny };
  }

  /** Returns the region code whose projected screen position is within
   * a small radius of the given CSS pixel coordinates, or null — plain
   * 2D distance against positions already computed for the DOM chips,
   * not a separate 3D raycast pass. */
  hitTest(screenX: number, screenY: number): string | null {
    for (const node of this.nodes) {
      const pos = projectToScreen(node.worldPosition, this.camera, this.width, this.height);
      if (pos.behindCamera) continue;
      if (Math.hypot(pos.x - screenX, pos.y - screenY) <= HOVER_RADIUS_PX) return node.code;
    }
    return null;
  }

  setHovered(code: string | null): void {
    this.hoveredCode = code;
  }

  /** Projected CSS pixel positions for the real DOM language-node chips
   * the wrapper component positions every frame. */
  projectedNodePositions(): readonly { code: string; x: number; y: number; visible: boolean }[] {
    return this.nodes.map((node) => {
      const pos = projectToScreen(node.worldPosition, this.camera, this.width, this.height);
      return { code: node.code, x: pos.x, y: pos.y, visible: !pos.behindCamera };
    });
  }

  resize(width: number, height: number): void {
    this.width = Math.max(width, 1);
    this.height = Math.max(height, 1);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.width, this.height, false);
  }

  update(deltaSeconds: number): void {
    this.elapsed += deltaSeconds;

    // Pointer parallax — always lerped, small max offset.
    this.pointerCurrent.x += (this.pointerTarget.x - this.pointerCurrent.x) * 0.05;
    this.pointerCurrent.y += (this.pointerTarget.y - this.pointerCurrent.y) * 0.05;
    this.camera.position.x = this.cameraBase.x + this.pointerCurrent.x * MAX_PARALLAX;
    this.camera.position.y = this.cameraBase.y - this.pointerCurrent.y * MAX_PARALLAX * 0.6;
    this.camera.lookAt(0, 0, 0);

    // Mic idle bob.
    this.micGroup.position.y = Math.sin(this.elapsed * 0.9) * 0.03;

    // Sound-wave rings: expand and fade, looping; faster + brighter
    // while a demo turn is active.
    const ringPeriod = this.micActive ? 1.1 : 2.4;
    this.rings.forEach((ring, i) => {
      const phase = ((this.elapsed + i * (ringPeriod / this.rings.length)) % ringPeriod) / ringPeriod;
      ring.scale.setScalar(1 + phase * (this.micActive ? 2.2 : 1.4));
      this.ringMaterials[i].opacity = (this.micActive ? 0.6 : 0.35) * (1 - phase);
    });

    // Ambient particle drift.
    this.ambientParticles.rotation.y += deltaSeconds * 0.02;
    this.ambientMaterial.opacity = 0.4 + 0.15 * Math.sin(this.elapsed * 0.5);

    // India outline breathing glow.
    this.outlineMaterial.opacity = 0.55 + 0.15 * Math.sin(this.elapsed * 0.6);
    this.markerMaterial.opacity = 0.8 + 0.15 * Math.sin(this.elapsed * 1.1);

    // Connection paths' traveling particles; hovered path brightens.
    this.nodes.forEach((node, i) => {
      const t = (this.elapsed * 0.15 + i / this.nodes.length) % 1;
      const point = node.curve.getPoint(t);
      const position = node.particle.geometry.getAttribute('position') as BufferAttribute;
      position.setXYZ(0, point.x, point.y, point.z);
      position.needsUpdate = true;

      const isHovered = this.hoveredCode === node.code;
      (node.particle.material as PointsMaterial).opacity = isHovered ? 1 : 0.75;
    });

    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    this.outlineMaterial.dispose();
    this.markerMaterial.dispose();
    this.ambientMaterial.dispose();
    this.scene.traverse((obj) => {
      const mesh = obj as Partial<Mesh> & { geometry?: BufferGeometry };
      mesh.geometry?.dispose();
      const material = (obj as Partial<Mesh>).material;
      if (Array.isArray(material)) {
        material.forEach((m) => m.dispose());
      } else {
        material?.dispose();
      }
    });
    this.renderer.dispose();
  }
}
