/**
 * The hero's scroll-driven narrative has four stages — listen, process,
 * think, respond (see landing.page.ts's `storyStages` and
 * hero-scene.ts) — told across one continuous `progress` value (0..1)
 * spanning the whole scrollable story region.
 *
 * This module is the single source of truth for turning that one number
 * into "how much are we in each stage right now", shared between the 3D
 * scene (which blends ring speed, particle motion, and core glow by
 * these weights) and the caption overlay (which crossfades by them) —
 * so the visual and the text are always telling the same moment of the
 * story, never slightly out of sync because two places computed it
 * differently.
 */

export const HERO_STORY_STAGE_COUNT = 4;

const STAGE_CENTERS = [0.125, 0.375, 0.625, 0.875];
const STAGE_WIDTH = 0.3;

/**
 * Smooth, overlapping per-stage weights summing to 1 (a simple triangular
 * falloff around each stage's center) for a given overall story
 * `progress`. Index 0 = listen, 1 = process, 2 = think, 3 = respond.
 */
export function heroStoryStageWeights(progress: number): readonly number[] {
  const raw = STAGE_CENTERS.map((center) =>
    Math.max(0, 1 - Math.abs(progress - center) / STAGE_WIDTH),
  );
  const sum = raw.reduce((a, b) => a + b, 0);
  return sum > 0 ? raw.map((w) => w / sum) : raw;
}
