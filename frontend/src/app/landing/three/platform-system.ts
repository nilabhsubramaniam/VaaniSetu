import {
  AdditiveBlending,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  Vector3,
} from 'three';
import type { DemoLanguageNode } from '../models/demo-language.model';
import { createLandmarkGeometry, type LandmarkType } from './landmark-geometry';

// Only the four languages actually depicted in the reference get a distinct
// landmark; everything else falls back to one shared generic monument
// shape rather than inventing a "signature landmark" for every language.
const LANDMARK_BY_CODE: Readonly<Record<string, LandmarkType>> = {
  ja: 'pagoda',
  hi: 'gate',
  en: 'skyline',
  es: 'colosseum',
};

function landmarkForCode(code: string): LandmarkType {
  return LANDMARK_BY_CODE[code] ?? 'generic';
}

interface PlatformEntry {
  readonly platform: Group;
  readonly beam: Mesh;
}

const UP = new Vector3(0, 1, 0);

/**
 * Floating circular platforms connected to the core by glowing beams, each
 * carrying a small stylized landmark — the "diorama" motif from the
 * reference design. Purely decorative (aria-hidden, like the DOM language
 * pills it sits alongside); position each frame from `LanguageSystem`'s
 * already-tuned, overlap-safe node positions rather than owning its own
 * placement logic.
 */
export class PlatformSystem {
  readonly group = new Group();
  private readonly entries: readonly PlatformEntry[];

  constructor(nodes: readonly DemoLanguageNode[], accentColor: string, goldColor: string) {
    this.entries = nodes.map((node) => {
      const platform = new Group();

      const disc = new Mesh(
        new CylinderGeometry(0.22, 0.25, 0.035, 20),
        new MeshBasicMaterial({ color: goldColor, transparent: true, opacity: 0.85 }),
      );
      platform.add(disc);

      const glow = new Mesh(
        new RingGeometry(0.24, 0.36, 32),
        new MeshBasicMaterial({
          color: accentColor,
          transparent: true,
          opacity: 0.35,
          side: DoubleSide,
          blending: AdditiveBlending,
          depthWrite: false,
        }),
      );
      glow.rotation.x = -Math.PI / 2;
      glow.position.y = -0.01;
      platform.add(glow);

      const landmark = createLandmarkGeometry(landmarkForCode(node.code), goldColor);
      landmark.scale.setScalar(0.46);
      landmark.position.y = 0.03;
      platform.add(landmark);

      this.group.add(platform);

      const beam = new Mesh(
        new CylinderGeometry(0.012, 0.012, 1, 6, 1, true),
        new MeshBasicMaterial({
          color: accentColor,
          transparent: true,
          opacity: 0.32,
          blending: AdditiveBlending,
          depthWrite: false,
          side: DoubleSide,
        }),
      );
      this.group.add(beam);

      return { platform, beam };
    });
  }

  update(nodePositions: readonly Vector3[], corePosition: Vector3): void {
    nodePositions.forEach((position, i) => {
      const entry = this.entries[i];
      if (!entry) return;

      entry.platform.position.copy(position);
      orientBeam(entry.beam, corePosition, position);
    });
  }

  dispose(): void {
    this.group.traverse((child) => {
      if (!(child instanceof Mesh)) return;
      child.geometry.dispose();
      const mat = child.material;
      if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
      else mat.dispose();
    });
  }
}

const beamDirection = new Vector3();
const beamMidpoint = new Vector3();

function orientBeam(beam: Mesh, start: Vector3, end: Vector3): void {
  beamDirection.subVectors(end, start);
  const length = beamDirection.length();
  beamMidpoint.copy(start).addScaledVector(beamDirection, 0.5);

  beam.position.copy(beamMidpoint);
  beam.scale.set(1, length, 1);
  beam.quaternion.setFromUnitVectors(UP, beamDirection.clone().normalize());
}
