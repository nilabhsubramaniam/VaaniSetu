import { heroStoryStageWeights } from './hero-story-progress';

describe('heroStoryStageWeights', () => {
  it('weighs entirely toward "listen" at the very start', () => {
    const [listen, process, think, respond] = heroStoryStageWeights(0);
    expect(listen).toBeGreaterThan(0.9);
    expect(process).toBeCloseTo(0, 5);
    expect(think).toBeCloseTo(0, 5);
    expect(respond).toBeCloseTo(0, 5);
  });

  it('weighs entirely toward "respond" at the very end', () => {
    const [listen, process, think, respond] = heroStoryStageWeights(1);
    expect(respond).toBeGreaterThan(0.9);
    expect(listen).toBeCloseTo(0, 5);
    expect(process).toBeCloseTo(0, 5);
    expect(think).toBeCloseTo(0, 5);
  });

  it('weighs mostly toward "process" at its own center, with a little spillover from both neighbors', () => {
    // Unlike "listen" and "respond" (each with only one neighboring
    // stage), the two interior stages sit between two neighbors whose
    // triangular falloff (width 0.3) reaches slightly past the 0.25
    // spacing between stage centers — so even at its own center,
    // "process" never reaches a pure 1.0. That continuous, gentle
    // three-way overlap is the intended "smooth cinematic transition",
    // not a bug: no stage ever cuts to fully alone except at the very
    // start and end of the story.
    const [listen, process, think, respond] = heroStoryStageWeights(0.375);
    expect(process).toBeCloseTo(0.75, 2);
    expect(listen).toBeCloseTo(0.125, 2);
    expect(think).toBeCloseTo(0.125, 2);
    expect(respond).toBeCloseTo(0, 5);
  });

  it('weighs mostly toward "think" at its own center, with the same symmetric spillover', () => {
    const [listen, process, think, respond] = heroStoryStageWeights(0.625);
    expect(think).toBeCloseTo(0.75, 2);
    expect(process).toBeCloseTo(0.125, 2);
    expect(respond).toBeCloseTo(0.125, 2);
    expect(listen).toBeCloseTo(0, 5);
  });

  it('blends smoothly between two adjacent stages at their midpoint', () => {
    const midpoint = (0.125 + 0.375) / 2; // between "listen" and "process"
    const [listen, process, think, respond] = heroStoryStageWeights(midpoint);
    expect(listen).toBeCloseTo(0.5, 1);
    expect(process).toBeCloseTo(0.5, 1);
    expect(think).toBeCloseTo(0, 5);
    expect(respond).toBeCloseTo(0, 5);
  });

  it('always sums to 1 across the whole 0..1 range', () => {
    for (let p = 0; p <= 1; p += 0.05) {
      const weights = heroStoryStageWeights(p);
      const sum = weights.reduce((a, b) => a + b, 0);
      expect(sum).toBeCloseTo(1, 5);
    }
  });

  it('never returns a negative weight', () => {
    for (let p = -0.2; p <= 1.2; p += 0.1) {
      for (const w of heroStoryStageWeights(p)) {
        expect(w).toBeGreaterThanOrEqual(0);
      }
    }
  });
});
