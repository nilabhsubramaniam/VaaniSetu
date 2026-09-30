import type { Camera, Vector3 } from 'three';

export interface ScreenPosition {
  readonly x: number;
  readonly y: number;
  /** True when the point is behind the camera — callers should hide
   * the projected element rather than show it at a garbage position. */
  readonly behindCamera: boolean;
}

/**
 * Projects a world-space point to CSS pixel coordinates within a
 * `width` x `height` viewport, using the camera's own
 * `Vector3.project()` (standard Three.js API, not reimplemented math).
 * This is the one narrow technique revived from the removed hero's
 * `project-to-screen.ts` (`docs/DECISIONS.md`'s Three.js ADR) — a real
 * DOM element (a language-node chip) gets positioned from a 3D point
 * every frame; nothing about *selecting* a language depends on this,
 * it's purely where a decorative label is drawn.
 */
export function projectToScreen(
  point: Vector3,
  camera: Camera,
  width: number,
  height: number,
): ScreenPosition {
  const projected = point.clone().project(camera);
  return {
    x: ((projected.x + 1) / 2) * width,
    y: ((1 - projected.y) / 2) * height,
    behindCamera: projected.z > 1,
  };
}
