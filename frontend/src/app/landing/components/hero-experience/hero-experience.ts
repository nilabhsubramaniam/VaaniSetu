import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  input,
  output,
  viewChild,
  viewChildren,
} from '@angular/core';
import { DEMO_LANGUAGE_NODES } from '../../models/demo-language.model';
import { HUD_PHASE_ORDER, HUD_PHASES } from '../../three/hud-system';
import { prefersReducedMotion, supportsWebGL } from '../../three/environment-support';
import type { HeroRuntime as HeroRuntimeType } from '../../three/hero-runtime';

@Component({
  selector: 'app-hero-experience',
  templateUrl: './hero-experience.html',
  styleUrl: './hero-experience.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HeroExperience implements AfterViewInit, OnDestroy {
  readonly selectedCode = input.required<string>();
  readonly nodeSelected = output<string>();

  readonly demoLanguages = DEMO_LANGUAGE_NODES;
  readonly hudPhases = HUD_PHASE_ORDER;
  readonly legendPhases = HUD_PHASE_ORDER.map((phase) => ({ phase, ...HUD_PHASES[phase] }));

  readonly canvasEl = viewChild<ElementRef<HTMLCanvasElement>>('canvasEl');
  readonly stageEl = viewChild<ElementRef<HTMLElement>>('stageEl');
  readonly pillEls = viewChildren<ElementRef<HTMLButtonElement>>('pillEl');
  readonly hudVoiceEl = viewChild<ElementRef<HTMLElement>>('hudVoiceEl');
  readonly hudLanguageEl = viewChild<ElementRef<HTMLElement>>('hudLanguageEl');
  readonly hudTranslationEl = viewChild<ElementRef<HTMLElement>>('hudTranslationEl');
  readonly hudConnectionEl = viewChild<ElementRef<HTMLElement>>('hudConnectionEl');

  private runtime: HeroRuntimeType | null = null;

  async ngAfterViewInit(): Promise<void> {
    if (prefersReducedMotion() || !supportsWebGL()) return;

    const canvas = this.canvasEl()?.nativeElement;
    const stage = this.stageEl()?.nativeElement;
    if (!canvas || !stage) return;

    const [{ HeroRuntime }, { computePerformanceTier }] = await Promise.all([
      import('../../three/hero-runtime'),
      import('../../three/scene-manager'),
    ]);

    const pillElements = new Map<string, HTMLElement>();
    this.pillEls().forEach((ref, i) => {
      const node = this.demoLanguages[i];
      if (node) pillElements.set(node.code, ref.nativeElement);
    });

    this.runtime = new HeroRuntime({
      canvas,
      container: stage,
      demoLanguages: this.demoLanguages,
      tier: computePerformanceTier(),
      hudLabelElements: {
        voice: this.hudVoiceEl()?.nativeElement ?? null,
        language: this.hudLanguageEl()?.nativeElement ?? null,
        translation: this.hudTranslationEl()?.nativeElement ?? null,
        connection: this.hudConnectionEl()?.nativeElement ?? null,
      },
      onLanguageNodesUpdate: (positions) => {
        for (const position of positions) {
          const el = pillElements.get(position.code);
          if (!el) continue;
          const scale = 1 - position.depth * 0.22;
          const opacity = position.visible ? 1 - position.depth * 0.55 : 0;
          el.style.left = `${position.xPercent}%`;
          el.style.top = `${position.yPercent}%`;
          el.style.transform = `translate(-50%, -50%) scale(${scale})`;
          el.style.opacity = `${opacity}`;
        }
      },
    });

    this.runtime.start();
  }

  ngOnDestroy(): void {
    this.runtime?.dispose();
  }

  selectNode(code: string): void {
    this.nodeSelected.emit(code);
  }

  triggerDemo(): void {
    this.runtime?.playDemoCycle();
  }
}
