import {
  BoxGeometry,
  ConeGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  TorusGeometry,
} from 'three';

export type LandmarkType = 'pagoda' | 'colosseum' | 'gate' | 'skyline' | 'generic';

/**
 * Stylized, low-poly landmark silhouettes riding each language platform —
 * deliberately iconographic rather than photoreal or tied to any specific
 * copyrighted 3D model: a generic tiered-roof shape reads as "pagoda", a
 * ring of pillars reads as "colosseum", and so on. This is the achievable,
 * real-time-WebGL translation of a photoreal reference render, not an
 * attempt to reproduce it literally.
 */
export function createLandmarkGeometry(type: LandmarkType, color: string): Group {
  switch (type) {
    case 'pagoda':
      return createPagoda(color);
    case 'colosseum':
      return createColosseum(color);
    case 'gate':
      return createGate(color);
    case 'skyline':
      return createSkyline(color);
    default:
      return createGenericMonument(color);
  }
}

function material(color: string): MeshBasicMaterial {
  return new MeshBasicMaterial({ color, transparent: true, opacity: 0.92 });
}

function createPagoda(color: string): Group {
  const group = new Group();
  const tiers = 3;
  const mat = material(color);

  for (let i = 0; i < tiers; i++) {
    const radius = 0.42 - i * 0.1;
    const y = i * 0.24;

    const body = new Mesh(new CylinderGeometry(radius * 0.55, radius * 0.55, 0.14, 6), mat);
    body.position.y = y;
    group.add(body);

    const roof = new Mesh(new ConeGeometry(radius, 0.14, 6), mat);
    roof.position.y = y + 0.12;
    group.add(roof);
  }

  const spire = new Mesh(new ConeGeometry(0.03, 0.22, 6), mat);
  spire.position.y = tiers * 0.24 + 0.1;
  group.add(spire);

  return group;
}

function createColosseum(color: string): Group {
  const group = new Group();
  const mat = material(color);
  const pillarCount = 12;
  const radius = 0.4;

  for (let i = 0; i < pillarCount; i++) {
    const angle = (2 * Math.PI * i) / pillarCount;
    const pillar = new Mesh(new BoxGeometry(0.06, 0.32, 0.06), mat);
    pillar.position.set(Math.cos(angle) * radius, 0.16, Math.sin(angle) * radius);
    group.add(pillar);
  }

  const ring = new Mesh(new TorusGeometry(radius, 0.03, 6, 24), mat);
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.32;
  group.add(ring);

  return group;
}

function createGate(color: string): Group {
  const group = new Group();
  const mat = material(color);

  const pillarLeft = new Mesh(new BoxGeometry(0.1, 0.6, 0.14), mat);
  pillarLeft.position.set(-0.26, 0.3, 0);
  group.add(pillarLeft);

  const pillarRight = new Mesh(new BoxGeometry(0.1, 0.6, 0.14), mat);
  pillarRight.position.set(0.26, 0.3, 0);
  group.add(pillarRight);

  const lintel = new Mesh(new BoxGeometry(0.68, 0.12, 0.16), mat);
  lintel.position.set(0, 0.63, 0);
  group.add(lintel);

  const crown = new Mesh(new BoxGeometry(0.5, 0.08, 0.18), mat);
  crown.position.set(0, 0.72, 0);
  group.add(crown);

  return group;
}

function createSkyline(color: string): Group {
  const group = new Group();
  const mat = material(color);
  const heights = [0.32, 0.52, 0.68, 0.42, 0.58];
  const spacing = 0.16;

  heights.forEach((h, i) => {
    const box = new Mesh(new BoxGeometry(0.1, h, 0.1), mat);
    box.position.set((i - (heights.length - 1) / 2) * spacing, h / 2, 0);
    group.add(box);
  });

  return group;
}

function createGenericMonument(color: string): Group {
  const group = new Group();
  const mat = material(color);

  const base = new Mesh(new CylinderGeometry(0.18, 0.22, 0.1, 8), mat);
  group.add(base);

  const obelisk = new Mesh(new ConeGeometry(0.12, 0.55, 4), mat);
  obelisk.position.y = 0.33;
  group.add(obelisk);

  return group;
}
