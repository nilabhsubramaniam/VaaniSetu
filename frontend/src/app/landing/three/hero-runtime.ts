import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Group,
  Points,
  PointsMaterial,
  Vector3,
} from 'three';
import type { DemoLanguageNode } from '../models/demo-language.model';
import { CoreSystem } from './core-system';
import { HUD_PHASE_ORDER, type HudPhase } from './hud-system';
import { InteractionController } from './interaction-controller';
import { LanguageSystem } from './language-system';
import { ParticleSystem } from './particle-system';
import { PlatformSystem } from './platform-system';
import { projectToScreen } from './project-to-screen';
import { readCssColor } from './read-css-color';
import { SceneManager, type PerformanceTier } from './scene-manager';
import { VoiceWave } from './voice-wave';

export interface LanguageNodeScreenPosition {
  code: string;
  xPercent: number;
  yPercent: number;
  visible: boolean;
  depth: number;
}

export interface HudLabelElements {
  readonly voice: HTMLElement | null;
  readonly language: HTMLElement | null;
  readonly translation: HTMLElement | null;
  readonly connection: HTMLElement | null;
}

export interface HeroRuntimeOptions {
  readonly canvas: HTMLCanvasElement;
  readonly container: HTMLElement;
  readonly demoLanguages: readonly DemoLanguageNode[];
  readonly hudLabelElements: HudLabelElements;
  readonly tier: PerformanceTier;
  onLanguageNodesUpdate(positions: readonly LanguageNodeScreenPosition[]): void;
  onPhaseChange?(phase: HudPhase): void;
}

// Depth-stratified composition bands. Fog (see SceneManager construction
// below) is tied to the page's own --vs-bg token so distant geometry
// dissolves into the page background instead of a black void.
const CAMERA_BASE = new Vector3(0, 1.05, 7.4);
const CAMERA_TARGET = new Vector3(0, 0.1, 0);
const CAMERA_POINTER_RANGE = new Vector3(0.85, 0.45, 0);
const CAMERA_DRIFT = new Vector3(0.22, 0.12, 0);
const CAMERA_SMOOTHING = 0.045;

const FOREGROUND_Z = 3.1;
const MIDGROUND_Z = 0;
const OUTPUT_WAVE_Z = -1.6;
const BACKGROUND_Z_NEAR = -6;
const BACKGROUND_Z_FAR = -15;

const FOG_NEAR = 8.5;
const FOG_FAR = 21;

function normalizeDepth(distance: number): number {
  return Math.min(Math.max((distance - 5.5) / 7.5, 0), 1);
}

const INBOUND_DURATION = 1.0;
const LANGUAGE_HOLD = 0.5;
const TRANSLATION_HOLD = 0.5;
const OUTBOUND_DURATION = 1.0;
const AUTO_LOOP_INTERVAL_MS = 7500;
const INITIAL_DELAY_MS = 900;

/**
 * Composition root for the hero's 3D scene: wires the core, waveforms,
 * language-node orbit, background dust, camera-rig parallax, and the
 * voice -> language -> translation -> connection demo phase sequence
 * together. The camera itself moves for parallax (`camera.position.lerp`);
 * `rootGroup.rotation` only changes on explicit drag, so idle parallax reads
 * as genuine depth rather than the whole scene spinning in place.
 */
export class HeroRuntime {
  private readonly sceneManager: SceneManager;
  private readonly rootGroup = new Group();
  private readonly core: CoreSystem;
  private readonly inputWave: VoiceWave;
  private readonly outputWave: VoiceWave;
  private readonly particles: ParticleSystem;
  private readonly languageSystem: LanguageSystem;
  private readonly platforms: PlatformSystem;
  private readonly interaction: InteractionController;
  private readonly dust: Points;
  private readonly desiredCameraPosition = new Vector3();
  private readonly languageNodeResults: LanguageNodeScreenPosition[];
  private autoLoopTimer: ReturnType<typeof setTimeout> | null = null;
  private phaseTimer: ReturnType<typeof setTimeout> | null = null;
  private currentPulse = 0;
  private targetPulse = 0;

  constructor(private readonly options: HeroRuntimeOptions) {
    const fogColor = readCssColor('--vs-bg', '#f7f4ee');
    const cyan = readCssColor('--vs-cyan', '#3f96b0');
    const violet = readCssColor('--vs-violet', '#5b4b8a');
    const gold = readCssColor('--vs-gold', '#b9812e');
    const deepBlue = readCssColor('--vs-deep-blue', '#2c4a7c');

    this.sceneManager = new SceneManager({
      canvas: options.canvas,
      cameraFov: 42,
      cameraPosition: [CAMERA_BASE.x, CAMERA_BASE.y, CAMERA_BASE.z],
      fogColor,
      fogNear: FOG_NEAR,
      fogFar: FOG_FAR,
    });
    this.sceneManager.camera.lookAt(CAMERA_TARGET);
    this.sceneManager.scene.add(this.rootGroup);

    // The hero copy is a centered text block sitting in the upper half of
    // the section; without this offset the core and its orbiting language
    // nodes render directly behind/through it. Shifting the whole
    // composition down clears that band while keeping the mic pedestal's
    // waveforms (already offset independently below) visually anchored to
    // the core above them.
    this.rootGroup.position.y = -1.5;

    this.core = new CoreSystem(cyan, violet, gold, deepBlue, options.tier);
    this.core.group.position.set(0, 0, MIDGROUND_Z);
    this.rootGroup.add(this.core.group);

    this.inputWave = new VoiceWave(1.6, cyan);
    this.inputWave.line.position.set(0, -1.85, FOREGROUND_Z);
    this.rootGroup.add(this.inputWave.line);

    this.outputWave = new VoiceWave(1.6, gold);
    this.outputWave.line.position.set(2.1, 1.25, OUTPUT_WAVE_Z);
    this.rootGroup.add(this.outputWave.line);

    this.particles = new ParticleSystem(240, cyan);
    this.rootGroup.add(this.particles.points);

    this.languageSystem = new LanguageSystem(options.demoLanguages);

    this.platforms = new PlatformSystem(options.demoLanguages, cyan, gold);
    this.rootGroup.add(this.platforms.group);

    this.languageNodeResults = options.demoLanguages.map((node) => ({
      code: node.code,
      xPercent: 50,
      yPercent: 50,
      visible: false,
      depth: 0,
    }));

    const dustCount = options.tier === 'full' ? 140 : 60;
    const dustPositions = new Float32Array(dustCount * 3);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 18;
      dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 10;
      dustPositions[i * 3 + 2] =
        BACKGROUND_Z_FAR + Math.random() * (BACKGROUND_Z_NEAR - BACKGROUND_Z_FAR);
    }
    const dustGeometry = new BufferGeometry();
    dustGeometry.setAttribute('position', new BufferAttribute(dustPositions, 3));
    this.dust = new Points(
      dustGeometry,
      new PointsMaterial({
        color: violet,
        size: 0.035,
        transparent: true,
        opacity: 0.4,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.rootGroup.add(this.dust);

    this.interaction = new InteractionController(options.container);

    this.sceneManager.onFrame((delta, elapsed) => this.tick(delta, elapsed));
  }

  start(): void {
    this.sceneManager.start();
    this.autoLoopTimer = setTimeout(() => this.loop(), INITIAL_DELAY_MS);
  }

  playDemoCycle(): void {
    this.runPhaseSequence();
  }

  dispose(): void {
    if (this.autoLoopTimer) clearTimeout(this.autoLoopTimer);
    if (this.phaseTimer) clearTimeout(this.phaseTimer);
    this.interaction.dispose();
    this.core.dispose();
    this.inputWave.dispose();
    this.outputWave.dispose();
    this.particles.dispose();
    this.platforms.dispose();
    this.dust.geometry.dispose();
    (this.dust.material as PointsMaterial).dispose();
    this.sceneManager.dispose();
  }

  private loop(): void {
    this.runPhaseSequence();
    this.autoLoopTimer = setTimeout(() => this.loop(), AUTO_LOOP_INTERVAL_MS);
  }

  private runPhaseSequence(): void {
    if (this.phaseTimer) clearTimeout(this.phaseTimer);

    this.inputWave.setActivity(true);
    this.targetPulse = 1;
    this.setPhase('voice');
    this.particles.spawnBurst(
      this.inputWave.line.position.clone(),
      this.core.group.position.clone(),
      24,
      INBOUND_DURATION,
    );

    this.phaseTimer = setTimeout(() => {
      this.setPhase('language');
      this.phaseTimer = setTimeout(() => {
        this.setPhase('translation');
        this.phaseTimer = setTimeout(() => {
          this.setPhase('connection');
          this.outputWave.setActivity(true);
          this.particles.spawnBurst(
            this.core.group.position.clone(),
            this.outputWave.line.position.clone(),
            24,
            OUTBOUND_DURATION,
          );

          this.phaseTimer = setTimeout(() => {
            this.inputWave.setActivity(false);
            this.outputWave.setActivity(false);
            this.targetPulse = 0;
            this.setPhase('ready');
          }, OUTBOUND_DURATION * 1000);
        }, TRANSLATION_HOLD * 1000);
      }, LANGUAGE_HOLD * 1000);
    }, INBOUND_DURATION * 1000);
  }

  private setPhase(phase: HudPhase): void {
    this.options.onPhaseChange?.(phase);
    for (const key of HUD_PHASE_ORDER) {
      const el = this.options.hudLabelElements[key];
      el?.classList.toggle('is-active', key === phase);
    }
  }

  private tick(delta: number, elapsed: number): void {
    const { parallax } = this.interaction;
    const drag = this.interaction.consumeDragDelta();
    if (drag.x !== 0 || drag.y !== 0) {
      this.rootGroup.rotation.y += drag.x * 0.005;
      this.rootGroup.rotation.x += drag.y * 0.005;
    }

    this.desiredCameraPosition.set(
      CAMERA_BASE.x +
        parallax.x * CAMERA_POINTER_RANGE.x +
        Math.sin(elapsed * 0.15) * CAMERA_DRIFT.x,
      CAMERA_BASE.y -
        parallax.y * CAMERA_POINTER_RANGE.y +
        Math.cos(elapsed * 0.12) * CAMERA_DRIFT.y,
      CAMERA_BASE.z,
    );
    this.sceneManager.camera.position.lerp(this.desiredCameraPosition, CAMERA_SMOOTHING);
    this.sceneManager.camera.lookAt(CAMERA_TARGET);

    this.currentPulse += (this.targetPulse - this.currentPulse) * Math.min(delta * 3, 1);
    this.core.update(delta, elapsed, this.currentPulse);
    this.inputWave.update(delta, elapsed);
    this.outputWave.update(delta, elapsed);
    this.particles.update(delta);
    this.languageSystem.update(elapsed);
    this.platforms.update(this.languageSystem.nodePositions, this.core.group.position);

    this.rootGroup.updateMatrixWorld();
    const camera = this.sceneManager.camera;
    this.languageSystem.nodePositions.forEach((localPosition, i) => {
      const worldPosition = localPosition.clone().applyMatrix4(this.rootGroup.matrixWorld);
      const screen = projectToScreen(worldPosition, camera);
      const distance = camera.position.distanceTo(worldPosition);
      const result = this.languageNodeResults[i];
      result.xPercent = screen.xPercent;
      result.yPercent = screen.yPercent;
      result.visible = screen.visible;
      result.depth = normalizeDepth(distance);
    });
    this.options.onLanguageNodesUpdate(this.languageNodeResults);
  }
}
