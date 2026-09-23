import {
  BufferAttribute,
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineSegments,
  Points,
  PointsMaterial,
  QuadraticBezierCurve3,
  Vector3,
} from 'three';

const RADIUS = 1.6;

function randomSpherePoint(radius: number): Vector3 {
  const u = Math.random();
  const v = Math.random();
  const theta = 2 * Math.PI * u;
  const phi = Math.acos(2 * v - 1);
  return new Vector3(
    radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.sin(phi) * Math.sin(theta),
    radius * Math.cos(phi),
  );
}

function createWireframeSphere(radius: number, latCount: number, lonCount: number): BufferGeometry {
  const points: number[] = [];
  const segments = 48;

  for (let i = 1; i < latCount; i++) {
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

function createConnectionArcs(count: number, color: string): LineSegments {
  const points: number[] = [];
  const arcSegments = 24;

  for (let i = 0; i < count; i++) {
    const start = randomSpherePoint(RADIUS);
    const end = randomSpherePoint(RADIUS);
    const mid = start
      .clone()
      .add(end)
      .multiplyScalar(0.5)
      .setLength(RADIUS * 1.35);
    const curve = new QuadraticBezierCurve3(start, mid, end);
    const curvePoints = curve.getPoints(arcSegments);

    for (let s = 0; s < curvePoints.length - 1; s++) {
      points.push(curvePoints[s].x, curvePoints[s].y, curvePoints[s].z);
      points.push(curvePoints[s + 1].x, curvePoints[s + 1].y, curvePoints[s + 1].z);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(new Float32Array(points), 3));
  return new LineSegments(
    geometry,
    new LineBasicMaterial({ color, transparent: true, opacity: 0.45 }),
  );
}

/**
 * A separate, lighter wireframe globe for the "global network" section —
 * explicitly non-geographic/conceptual (random great-circle-ish arcs, not
 * real city coordinates), distinct from the hero's abstract "core".
 */
export class GlobeNetwork {
  readonly group = new Group();

  private readonly wireframe: LineSegments;
  private readonly arcs: LineSegments;
  private readonly nodes: Points;

  constructor(accentColor: string, goldAccent: string, nodeCount = 14, arcCount = 10) {
    this.wireframe = new LineSegments(
      createWireframeSphere(RADIUS, 8, 12),
      new LineBasicMaterial({ color: accentColor, transparent: true, opacity: 0.3 }),
    );
    this.group.add(this.wireframe);

    this.arcs = createConnectionArcs(arcCount, accentColor);
    this.group.add(this.arcs);

    const nodePositions: number[] = [];
    for (let i = 0; i < nodeCount; i++) {
      const p = randomSpherePoint(RADIUS);
      nodePositions.push(p.x, p.y, p.z);
    }
    const nodeGeometry = new BufferGeometry();
    nodeGeometry.setAttribute('position', new BufferAttribute(new Float32Array(nodePositions), 3));
    this.nodes = new Points(
      nodeGeometry,
      new PointsMaterial({ color: goldAccent, size: 0.06, transparent: true, opacity: 0.9 }),
    );
    this.group.add(this.nodes);
  }

  update(delta: number): void {
    this.group.rotation.y += delta * 0.06;
  }

  dispose(): void {
    this.wireframe.geometry.dispose();
    (this.wireframe.material as LineBasicMaterial).dispose();
    this.arcs.geometry.dispose();
    (this.arcs.material as LineBasicMaterial).dispose();
    this.nodes.geometry.dispose();
    (this.nodes.material as PointsMaterial).dispose();
  }
}
