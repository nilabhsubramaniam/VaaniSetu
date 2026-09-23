import { PerspectiveCamera, Vector3 } from 'three';
import { projectToScreen } from './project-to-screen';

describe('projectToScreen', () => {
  it('projects a point directly in front of the camera to the viewport center', () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const result = projectToScreen(new Vector3(0, 0, 0), camera);

    expect(result.xPercent).toBeCloseTo(50, 0);
    expect(result.yPercent).toBeCloseTo(50, 0);
    expect(result.visible).toBe(true);
  });

  it('marks a point behind the camera as not visible', () => {
    const camera = new PerspectiveCamera(50, 1, 0.1, 100);
    camera.position.set(0, 0, 5);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    const result = projectToScreen(new Vector3(0, 0, 20), camera);

    expect(result.visible).toBe(false);
  });
});
