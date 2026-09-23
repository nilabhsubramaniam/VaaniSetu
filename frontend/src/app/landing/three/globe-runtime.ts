import { readCssColor } from './read-css-color';
import { SceneManager } from './scene-manager';
import { GlobeNetwork } from './globe-network';

export interface GlobeRuntimeOptions {
  readonly canvas: HTMLCanvasElement;
}

/** Composition root for the "global network" section's standalone globe. */
export class GlobeRuntime {
  private readonly sceneManager: SceneManager;
  private readonly globe: GlobeNetwork;

  constructor(options: GlobeRuntimeOptions) {
    const cyan = readCssColor('--vs-cyan', '#3f96b0');
    const gold = readCssColor('--vs-gold', '#b9812e');
    const fogColor = readCssColor('--vs-bg', '#f7f4ee');

    this.sceneManager = new SceneManager({
      canvas: options.canvas,
      cameraFov: 40,
      cameraPosition: [0, 0, 4.4],
      fogColor,
      fogNear: 5,
      fogFar: 9,
    });
    this.sceneManager.camera.lookAt(0, 0, 0);

    this.globe = new GlobeNetwork(cyan, gold);
    this.sceneManager.scene.add(this.globe.group);

    this.sceneManager.onFrame((delta) => this.globe.update(delta));
  }

  start(): void {
    this.sceneManager.start();
  }

  dispose(): void {
    this.globe.dispose();
    this.sceneManager.dispose();
  }
}
