import { BufferAttribute, BufferGeometry, Line, LineBasicMaterial } from 'three';

const SEGMENT_COUNT = 48;

/**
 * A single animated waveform line, used for both the "input" (mic) and
 * "output" (translated speech) waveforms flanking the hero's core. Activity
 * level drives amplitude — idle renders as a near-flat line, active as a
 * traveling sine wave — rather than a decorative animation that runs
 * regardless of state.
 */
export class VoiceWave {
  readonly line: Line;
  private readonly geometry: BufferGeometry;
  private readonly positions: Float32Array;
  private activity = 0;
  private targetActivity = 0;

  constructor(
    private readonly width: number,
    color: string,
  ) {
    this.positions = new Float32Array(SEGMENT_COUNT * 3);
    this.geometry = new BufferGeometry();
    this.geometry.setAttribute('position', new BufferAttribute(this.positions, 3));

    const material = new LineBasicMaterial({ color, transparent: true, opacity: 0.85 });
    this.line = new Line(this.geometry, material);
    this.writePositions(0);
  }

  setActivity(active: boolean): void {
    this.targetActivity = active ? 1 : 0;
  }

  update(delta: number, elapsed: number): void {
    this.activity += (this.targetActivity - this.activity) * Math.min(delta * 4, 1);
    this.writePositions(elapsed);
  }

  private writePositions(elapsed: number): void {
    const amplitude = 0.03 + this.activity * 0.22;
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const t = i / (SEGMENT_COUNT - 1);
      const x = (t - 0.5) * this.width;
      const wave = Math.sin(t * Math.PI * 6 + elapsed * 5) * amplitude;
      const falloff = Math.sin(t * Math.PI);
      this.positions[i * 3] = x;
      this.positions[i * 3 + 1] = wave * falloff;
      this.positions[i * 3 + 2] = 0;
    }
    this.geometry.attributes['position'].needsUpdate = true;
  }

  dispose(): void {
    this.geometry.dispose();
    (this.line.material as LineBasicMaterial).dispose();
  }
}
