import { Vector3 } from 'three';
import type { DemoLanguageNode } from '../models/demo-language.model';

// Nodes sit on fixed base angles across a restricted arc, with a small
// sine-wave sway — NOT a continuous 360° orbit. An earlier version rotated
// nodes fully around the core and periodically threw them off-screen (or
// behind the hero copy) whenever an angle pointed left/toward the camera;
// perspective divides blew up their screen coordinates at those extremes.
const SAFE_ARC_RADIANS = (165 * Math.PI) / 180;
// Centers the arc slightly below horizontal (front/right, tilted down) so
// nodes clear both the hero copy above and the mic sitting at the core's
// top pole, instead of wrapping over either.
const ARC_CENTER_RADIANS = (-22 * Math.PI) / 180;
const SWAY_AMPLITUDE_RADIANS = (6 * Math.PI) / 180;

// View-plane ellipse (X/Y), with depth added independently via a second
// harmonic on Z — not a ground-plane (X/Z) ellipse, which collapsed toward
// screen-center at its extremes and dropped nodes onto the core.
const ELLIPSE_X = 0.82;
const ELLIPSE_Y = 0.4;
const RING_DEPTH_OFFSET = -1.2;
const RING_Y_OFFSET = 0.3;
const DEPTH_SPREAD = 1.4;

// Alternating near/far radii fan nodes out onto two loose arcs instead of
// one tight curve, so evenly-spaced angles don't read as a single crowded
// line of overlapping pills.
const BASE_RADIUS = 2.6;
const FAR_RADIUS = 3.25;

/**
 * Positions demo language nodes around the hero core. Base angles are fixed
 * per node (spread evenly across the safe arc, centered on the front/right)
 * so a node's identity stays put in space; only a small idle sway and the
 * caller's own drag/parallax transform move it further.
 */
export class LanguageSystem {
  readonly nodePositions: readonly Vector3[];
  private readonly baseAngles: readonly number[];
  private readonly currentRadii: number[];

  constructor(private readonly nodes: readonly DemoLanguageNode[]) {
    const count = nodes.length;
    const start = ARC_CENTER_RADIANS - SAFE_ARC_RADIANS / 2;
    this.baseAngles = nodes.map((_, i) => start + (SAFE_ARC_RADIANS * i) / Math.max(count - 1, 1));
    this.currentRadii = nodes.map((_, i) => (i % 2 === 0 ? BASE_RADIUS : FAR_RADIUS));
    this.nodePositions = nodes.map(() => new Vector3());
  }

  update(elapsed: number): void {
    for (let i = 0; i < this.nodes.length; i++) {
      const angle = this.baseAngles[i] + Math.sin(elapsed * 0.3 + i) * SWAY_AMPLITUDE_RADIANS;
      const radius = this.currentRadii[i];

      const x = Math.cos(angle) * radius * ELLIPSE_X;
      const y =
        RING_Y_OFFSET + Math.sin(angle) * radius * ELLIPSE_Y + Math.sin(elapsed * 0.4 + i) * 0.05;
      const z = RING_DEPTH_OFFSET + Math.sin(angle * 2) * radius * DEPTH_SPREAD * 0.4;

      this.nodePositions[i].set(x, y, z);
    }
  }
}
