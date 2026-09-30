import { INDIA_OUTLINE, INDIA_REGION_POSITIONS } from './india-outline-data';

describe('india-outline-data', () => {
  it('has a real, non-trivial outline', () => {
    expect(INDIA_OUTLINE.length).toBeGreaterThan(100);
  });

  it('is a closed-ish loop (first and last points are close together)', () => {
    const [firstX, firstY] = INDIA_OUTLINE[0];
    const [lastX, lastY] = INDIA_OUTLINE[INDIA_OUTLINE.length - 1];
    const distance = Math.hypot(firstX - lastX, firstY - lastY);
    expect(distance).toBeLessThan(0.1);
  });

  it('every region position falls within the outline\'s bounding box', () => {
    const xs = INDIA_OUTLINE.map(([x]) => x);
    const ys = INDIA_OUTLINE.map(([, y]) => y);
    const bounds = {
      minX: Math.min(...xs),
      maxX: Math.max(...xs),
      minY: Math.min(...ys),
      maxY: Math.max(...ys),
    };

    for (const [code, [x, y]] of Object.entries(INDIA_REGION_POSITIONS)) {
      expect(x, `${code}.x within bounds`).toBeGreaterThanOrEqual(bounds.minX);
      expect(x, `${code}.x within bounds`).toBeLessThanOrEqual(bounds.maxX);
      expect(y, `${code}.y within bounds`).toBeGreaterThanOrEqual(bounds.minY);
      expect(y, `${code}.y within bounds`).toBeLessThanOrEqual(bounds.maxY);
    }
  });

  it('places the northernmost region (Kashmir) above the southernmost (Tamil Nadu)', () => {
    const [, ksY] = INDIA_REGION_POSITIONS['ks'];
    const [, taY] = INDIA_REGION_POSITIONS['ta'];
    expect(ksY).toBeGreaterThan(taY);
  });

  it('has one position per hero region referenced in hero-region.model.ts', () => {
    const codes = ['as', 'pa', 'bn', 'ks', 'ta', 'kok'];
    for (const code of codes) {
      expect(INDIA_REGION_POSITIONS[code], code).toBeDefined();
    }
  });
});
