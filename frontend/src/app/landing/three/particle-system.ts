import { BufferAttribute, BufferGeometry, Points, PointsMaterial, Vector3 } from 'three';

interface ActiveBurst {
  readonly start: Vector3;
  readonly end: Vector3;
  readonly indices: readonly number[];
  age: number;
  readonly duration: number;
}

const PARKED_Z = -1000;

/**
 * Pooled `THREE.Points` burst emitter: particles travel from `start` to
 * `end` over `duration`. Pre-allocates its full particle budget up front and
 * "parks" inactive particles far behind the camera instead of resizing
 * buffers per burst, since per-frame geometry allocation is what actually
 * costs frame time in Three.js, not the particle draw itself.
 */
export class ParticleSystem {
  readonly points: Points;
  private readonly geometry: BufferGeometry;
  private readonly positions: Float32Array;
  private readonly capacity: number;
  private cursor = 0;
  private readonly bursts: ActiveBurst[] = [];

  constructor(capacity: number, color: string, size = 0.05) {
    this.capacity = capacity;
    this.positions = new Float32Array(capacity * 3);
    for (let i = 0; i < capacity; i++) {
      this.positions[i * 3 + 2] = PARKED_Z;
    }

    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3));

    const material = new PointsMaterial({
      color,
      size,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });

    this.points = new Points(this.geometry, material);
  }

  spawnBurst(start: Vector3, end: Vector3, count: number, duration: number): void {
    const indices: number[] = [];
    for (let n = 0; n < count; n++) {
      const index = this.cursor;
      this.cursor = (this.cursor + 1) % this.capacity;
      indices.push(index);
    }
    this.bursts.push({ start, end, indices, age: 0, duration });
  }

  update(delta: number): void {
    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const burst = this.bursts[i];
      burst.age += delta;
      const t = Math.min(burst.age / burst.duration, 1);

      for (const index of burst.indices) {
        const x = burst.start.x + (burst.end.x - burst.start.x) * t;
        const y = burst.start.y + (burst.end.y - burst.start.y) * t;
        const z = burst.start.z + (burst.end.z - burst.start.z) * t;
        this.positions[index * 3] = x;
        this.positions[index * 3 + 1] = y;
        this.positions[index * 3 + 2] = z;
      }

      if (t >= 1) {
        for (const index of burst.indices) {
          this.positions[index * 3 + 2] = PARKED_Z;
        }
        this.bursts.splice(i, 1);
      }
    }

    this.geometry.attributes['position'].needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    (this.points.material as PointsMaterial).dispose();
  }
}
