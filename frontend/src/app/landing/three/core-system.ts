import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  DoubleSide,
  EdgesGeometry,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  RingGeometry,
  ShaderMaterial,
  SphereGeometry,
} from 'three';
import type { PerformanceTier } from './scene-manager';

const RIM_VERTEX_SHADER = `
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    vNormal = normalize(normalMatrix * normal);
    vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
    vViewDir = normalize(-viewPosition.xyz);
    gl_Position = projectionMatrix * viewPosition;
  }
`;

const RIM_FRAGMENT_SHADER = `
  uniform vec3 rimColor;
  uniform float rimStrength;
  varying vec3 vNormal;
  varying vec3 vViewDir;
  void main() {
    float rim = 1.0 - max(dot(vNormal, vViewDir), 0.0);
    float intensity = pow(rim, 5.0) * rimStrength;
    gl_FragColor = vec4(rimColor, intensity);
  }
`;

/**
 * Sparse latitude/longitude wireframe cage. Kept deliberately sparse (low
 * lat/lon counts) — a denser grid merges into a milky fill at the hero's
 * on-screen size and stops reading as an open lattice.
 */
function createLatLongGeometry(
  radius: number,
  latCount: number,
  lonCount: number,
  segments: number,
): BufferGeometry {
  const points: number[] = [];

  for (let i = 0; i <= latCount; i++) {
    const lat = (Math.PI * i) / latCount - Math.PI / 2;
    for (let s = 0; s < segments; s++) {
      const lon1 = (2 * Math.PI * s) / segments;
      const lon2 = (2 * Math.PI * (s + 1)) / segments;
      points.push(
        radius * Math.cos(lat) * Math.cos(lon1),
        radius * Math.sin(lat),
        radius * Math.cos(lat) * Math.sin(lon1),
        radius * Math.cos(lat) * Math.cos(lon2),
        radius * Math.sin(lat),
        radius * Math.cos(lat) * Math.sin(lon2),
      );
    }
  }

  for (let j = 0; j < lonCount; j++) {
    const lon = (2 * Math.PI * j) / lonCount;
    for (let s = 0; s < segments; s++) {
      const lat1 = (Math.PI * s) / segments - Math.PI / 2;
      const lat2 = (Math.PI * (s + 1)) / segments - Math.PI / 2;
      points.push(
        radius * Math.cos(lat1) * Math.cos(lon),
        radius * Math.sin(lat1),
        radius * Math.cos(lat1) * Math.sin(lon),
        radius * Math.cos(lat2) * Math.cos(lon),
        radius * Math.sin(lat2),
        radius * Math.cos(lat2) * Math.sin(lon),
      );
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(points), 3));
  return geometry;
}

function fibonacciSpherePoints(count: number, radius: number): number[] {
  const points: number[] = [];
  const goldenAngle = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < count; i++) {
    const y = 1 - (i / Math.max(count - 1, 1)) * 2;
    const radiusAtY = Math.sqrt(Math.max(1 - y * y, 0));
    const theta = goldenAngle * i;
    points.push(
      Math.cos(theta) * radiusAtY * radius,
      y * radius,
      Math.sin(theta) * radiusAtY * radius,
    );
  }
  return points;
}

interface RibbonSpec {
  readonly radius: number;
  readonly width: number;
  readonly tilt: readonly [number, number, number];
  readonly speed: number;
}

const RIBBONS: readonly RibbonSpec[] = [
  { radius: 1.22, width: 0.055, tilt: [Math.PI / 2.3, 0.4, 0], speed: 0.12 },
  { radius: 1.44, width: 0.042, tilt: [Math.PI / 2.8, -0.6, 0.2], speed: -0.09 },
  { radius: 1.66, width: 0.03, tilt: [Math.PI / 2.1, 0.9, -0.3], speed: 0.06 },
];

/**
 * The hero's central visual: a stylized, translucent "glass Earth" —
 * layered wireframe/lattice/glass-shell geometry rather than a textured
 * photoreal globe. It approximates the mood of a photoreal reference render
 * (glowing glass, orbital rings, cyan/gold glow) within what real-time
 * WebGL can actually render, rather than attempting literal photoreal
 * fidelity or reusing textured Earth imagery.
 */
export class CoreSystem {
  readonly group = new Group();

  private readonly engineFill: Mesh;
  private readonly engineEdges: LineSegments;
  private readonly lattice: LineSegments;
  private readonly connectionPoints: Points | null;
  private readonly shell: Mesh;
  private readonly shellMaterial: ShaderMaterial;
  private readonly ribbons: readonly Mesh[];
  private readonly spokes: LineSegments;
  private readonly scanArc: Mesh;
  private readonly scanArcMaterial: MeshBasicMaterial;
  private readonly ambientParticles: Points;
  private readonly cyanColor: Color;
  private readonly goldColor: Color;

  constructor(
    accentColor: string,
    accentSoftColor: string,
    goldAccent: string,
    bodyColor: string,
    tier: PerformanceTier,
  ) {
    const isFull = tier === 'full';
    this.cyanColor = new Color(accentColor);
    this.goldColor = new Color(goldAccent);

    // 1. Inner "engine" — a near-invisible wire armature, not a flat solid.
    const engineGeometry = new IcosahedronGeometry(0.44, 0);
    this.engineFill = new Mesh(
      engineGeometry,
      new MeshBasicMaterial({ color: accentSoftColor, transparent: true, opacity: 0.04 }),
    );
    this.engineEdges = new LineSegments(
      new EdgesGeometry(engineGeometry),
      new LineBasicMaterial({ color: accentSoftColor, transparent: true, opacity: 0.7 }),
    );
    this.group.add(this.engineFill, this.engineEdges);

    // 2. Filled "body" — translucent glass, not an opaque solid. Gives the
    // core visual weight while staying see-through, per the reference's
    // "glowing, translucent glass Earth".
    const body = new Mesh(
      new SphereGeometry(0.99, 32, 24),
      new MeshBasicMaterial({ color: bodyColor, transparent: true, opacity: 0.4, fog: true }),
    );
    this.group.add(body);

    // 3. Lat/long lattice cage — a visible glass-grid line pattern on the
    // globe's surface, echoing the reference's glowing orbital/grid lines.
    this.lattice = new LineSegments(
      createLatLongGeometry(1.005, isFull ? 6 : 4, isFull ? 8 : 6, 48),
      new LineBasicMaterial({ color: accentSoftColor, transparent: true, opacity: 0.65 }),
    );
    this.group.add(this.lattice);

    // 4. Gold connection points, full tier only.
    if (isFull) {
      const connectionGeometry = new BufferGeometry();
      connectionGeometry.setAttribute(
        'position',
        new BufferAttribute(new Float32Array(fibonacciSpherePoints(7, 1.01)), 3),
      );
      this.connectionPoints = new Points(
        connectionGeometry,
        new PointsMaterial({ color: goldAccent, size: 0.05, transparent: true, opacity: 0.9 }),
      );
      this.lattice.add(this.connectionPoints);
    } else {
      this.connectionPoints = null;
    }

    // 5. Glass shell — Fresnel rim only, front-face rendering. BackSide was
    // tried and made the whole shell saturate into a solid ball, since
    // inward-facing normals clamp the rim term to its maximum everywhere.
    this.shellMaterial = new ShaderMaterial({
      uniforms: {
        rimColor: { value: new Color(accentColor) },
        rimStrength: { value: 0.85 },
      },
      vertexShader: RIM_VERTEX_SHADER,
      fragmentShader: RIM_FRAGMENT_SHADER,
      transparent: true,
      depthWrite: false,
    });
    this.shell = new Mesh(new SphereGeometry(1.05, 32, 24), this.shellMaterial);
    this.group.add(this.shell);

    // 6. Orbital ribbons — glossy annuli with real width, not hairlines.
    this.ribbons = RIBBONS.map((spec) => {
      const mesh = new Mesh(
        new RingGeometry(spec.radius, spec.radius + spec.width, 96),
        new MeshBasicMaterial({
          color: accentColor,
          transparent: true,
          opacity: 0.62,
          side: DoubleSide,
          fog: true,
        }),
      );
      mesh.rotation.set(...spec.tilt);
      this.group.add(mesh);
      return mesh;
    });

    // 7. Radial spokes reticle.
    const spokePoints: number[] = [];
    const spokeCount = 12;
    for (let i = 0; i < spokeCount; i++) {
      const angle = (2 * Math.PI * i) / spokeCount;
      spokePoints.push(
        Math.cos(angle) * 1.16,
        Math.sin(angle) * 1.16,
        0,
        Math.cos(angle) * 1.3,
        Math.sin(angle) * 1.3,
        0,
      );
    }
    const spokeGeometry = new BufferGeometry();
    spokeGeometry.setAttribute('position', new BufferAttribute(new Float32Array(spokePoints), 3));
    this.spokes = new LineSegments(
      spokeGeometry,
      new LineBasicMaterial({ color: accentSoftColor, transparent: true, opacity: 0.35 }),
    );
    this.group.add(this.spokes);

    // 8. Sweeping scan-arc, tilted into an orbital plane rather than
    // camera-facing (flat/camera-facing looked like a crescent pasted on).
    this.scanArcMaterial = new MeshBasicMaterial({
      color: accentColor,
      transparent: true,
      opacity: 0.75,
      side: DoubleSide,
    });
    this.scanArc = new Mesh(
      new RingGeometry(1.78, 1.85, 64, 1, 0, Math.PI * 0.6),
      this.scanArcMaterial,
    );
    this.scanArc.rotation.set(Math.PI / 2.5, 0, 0);
    this.group.add(this.scanArc);

    // 9. Ambient particle field hugging the core.
    const ambientCount = isFull ? 80 : 36;
    const ambientPositions = fibonacciSpherePoints(ambientCount, 1.9);
    const ambientGeometry = new BufferGeometry();
    ambientGeometry.setAttribute(
      'position',
      new BufferAttribute(new Float32Array(ambientPositions), 3),
    );
    this.ambientParticles = new Points(
      ambientGeometry,
      new PointsMaterial({
        color: accentSoftColor,
        size: 0.03,
        transparent: true,
        opacity: 0.5,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.group.add(this.ambientParticles);
  }

  update(delta: number, elapsed: number, pulse: number): void {
    this.lattice.rotation.y += delta * 0.08;
    this.engineFill.rotation.y -= delta * 0.15;
    this.engineEdges.rotation.y -= delta * 0.15;
    this.spokes.rotation.z += delta * 0.05;
    this.scanArc.rotation.z += delta * 0.35;
    this.ambientParticles.rotation.y += delta * 0.02;

    this.ribbons.forEach((ribbon, i) => {
      ribbon.rotation.z += delta * RIBBONS[i].speed;
    });

    const fillPulse = 0.04 + pulse * 0.16;
    (this.engineFill.material as MeshBasicMaterial).opacity = fillPulse;
    (this.engineEdges.material as LineBasicMaterial).opacity = 0.7 - pulse * 0.4;

    this.shellMaterial.uniforms['rimStrength'].value = 0.85 + pulse * 0.3;
    (this.shellMaterial.uniforms['rimColor'].value as Color).lerpColors(
      this.cyanColor,
      this.goldColor,
      pulse,
    );
    (this.scanArcMaterial.color as Color).lerpColors(this.cyanColor, this.goldColor, pulse);

    void elapsed;
  }

  dispose(): void {
    this.group.traverse((child) => {
      if (child instanceof Mesh || child instanceof LineSegments || child instanceof Points) {
        child.geometry.dispose();
        const material = child.material;
        if (Array.isArray(material)) material.forEach((m) => m.dispose());
        else material.dispose();
      }
    });
  }
}
