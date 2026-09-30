import { Vector3 } from 'three';
import {
  RING_COUNT_BY_TIER,
  PARTICLE_COUNT_BY_TIER,
  buildConnectionCurve,
  type DeviceTier,
} from './hero-scene';

// `HeroScene` itself isn't instantiated here — its constructor creates a
// real `WebGLRenderer`, which throws without an actual WebGL context
// (jsdom, this project's test environment, has none). These are the
// pure-logic pieces extracted specifically so they're testable without
// one, same approach `india-outline-data.spec.ts` already established.

describe('device tiers', () => {
  it('the reduced tier has fewer rings and particles than the full tier', () => {
    const tiers: readonly DeviceTier[] = ['full', 'reduced'];
    for (const tier of tiers) {
      expect(RING_COUNT_BY_TIER[tier]).toBeGreaterThan(0);
      expect(PARTICLE_COUNT_BY_TIER[tier]).toBeGreaterThan(0);
    }
    expect(RING_COUNT_BY_TIER.reduced).toBeLessThan(RING_COUNT_BY_TIER.full);
    expect(PARTICLE_COUNT_BY_TIER.reduced).toBeLessThan(PARTICLE_COUNT_BY_TIER.full);
  });
});

describe('buildConnectionCurve', () => {
  it('starts and ends at the given points', () => {
    const from = new Vector3(0, 0, 0);
    const to = new Vector3(2, 0, -1);
    const curve = buildConnectionCurve(from, to, 0.5);

    expect(curve.getPointAt(0).distanceTo(from)).toBeCloseTo(0, 5);
    expect(curve.getPointAt(1).distanceTo(to)).toBeCloseTo(0, 5);
  });

  it('bows upward at the midpoint by roughly the given lift', () => {
    const from = new Vector3(0, 0, 0);
    const to = new Vector3(2, 0, 0);
    const curve = buildConnectionCurve(from, to, 0.6);

    const midHeight = curve.getPointAt(0.5).y;
    expect(midHeight).toBeGreaterThan(0.3);
  });

  it('does not mutate the input vectors', () => {
    const from = new Vector3(1, 1, 1);
    const to = new Vector3(2, 2, 2);
    buildConnectionCurve(from, to, 0.6);

    expect(from).toEqual(new Vector3(1, 1, 1));
    expect(to).toEqual(new Vector3(2, 2, 2));
  });
});
