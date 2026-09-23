import type { Camera, Vector3 } from 'three';

export interface ScreenPosition {
  readonly xPercent: number;
  readonly yPercent: number;
  readonly visible: boolean;
}

/**
 * Projects a world-space position to viewport percentages, for positioning
 * real DOM elements (language pills, HUD labels) over the canvas rather than
 * drawing them as texture/sprite geometry.
 */
export function projectToScreen(position: Vector3, camera: Camera): ScreenPosition {
  const projected = position.clone().project(camera);
  const visible = projected.z < 1 && projected.z > -1;
  return {
    xPercent: (projected.x * 0.5 + 0.5) * 100,
    yPercent: (-projected.y * 0.5 + 0.5) * 100,
    visible,
  };
}
