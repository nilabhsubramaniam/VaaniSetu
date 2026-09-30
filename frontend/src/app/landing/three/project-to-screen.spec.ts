import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { projectToScreen } from './project-to-screen';

describe('projectToScreen', () => {
  it('maps the camera-space origin to the center of the viewport', () => {
    const camera = new OrthographicCamera(-1, 1, 1, -1, 0.1, 10);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const result = projectToScreen(new Vector3(0, 0, 0), camera, 800, 600);

    expect(result.x).toBeCloseTo(400, 0);
    expect(result.y).toBeCloseTo(300, 0);
    expect(result.behindCamera).toBe(false);
  });

  it('flags a point behind the camera', () => {
    // hero-scene.ts always uses a PerspectiveCamera in practice — that's
    // what actually needs "behind camera" detection (an orthographic
    // camera's linear depth mapping doesn't flip sign the same way).
    const camera = new PerspectiveCamera(50, 800 / 600, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    // Behind the camera along its own look direction (camera looks
    // toward -z from z=5; z=20 is on the far side of the camera itself).
    const result = projectToScreen(new Vector3(0, 0, 20), camera, 800, 600);

    expect(result.behindCamera).toBe(true);
  });

  it('moves right/up in world space to the right/upper half of the screen', () => {
    const camera = new OrthographicCamera(-2, 2, 2, -2, 0.1, 10);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const right = projectToScreen(new Vector3(1, 0, 0), camera, 800, 600);
    const up = projectToScreen(new Vector3(0, 1, 0), camera, 800, 600);

    expect(right.x).toBeGreaterThan(400);
    expect(up.y).toBeLessThan(300); // screen Y grows downward
  });
});
