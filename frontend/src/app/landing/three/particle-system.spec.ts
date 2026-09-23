import { Vector3 } from 'three';
import { ParticleSystem } from './particle-system';

describe('ParticleSystem', () => {
  it('parks all particles far behind the camera before any burst is spawned', () => {
    const system = new ParticleSystem(8, '#ffffff');
    const positions = system.points.geometry.getAttribute('position');

    for (let i = 0; i < 8; i++) {
      expect(positions.getZ(i)).toBeLessThan(-500);
    }
  });

  it('moves burst particles from start toward end as it updates', () => {
    const system = new ParticleSystem(4, '#ffffff');
    const start = new Vector3(0, 0, 0);
    const end = new Vector3(1, 0, 0);
    system.spawnBurst(start, end, 4, 1);

    system.update(0.5);

    const positions = system.points.geometry.getAttribute('position');
    expect(positions.getX(0)).toBeCloseTo(0.5, 1);
  });

  it('re-parks particles once a burst completes', () => {
    const system = new ParticleSystem(4, '#ffffff');
    system.spawnBurst(new Vector3(0, 0, 0), new Vector3(1, 0, 0), 4, 1);

    system.update(1.5);

    const positions = system.points.geometry.getAttribute('position');
    expect(positions.getZ(0)).toBeLessThan(-500);
  });
});
