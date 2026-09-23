import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  OnDestroy,
  input,
  viewChild,
} from '@angular/core';
import { prefersReducedMotion, supportsWebGL } from '../../three/environment-support';
import type { GlobeRuntime as GlobeRuntimeType } from '../../three/globe-runtime';

@Component({
  selector: 'app-global-network',
  templateUrl: './global-network.html',
  styleUrl: './global-network.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GlobalNetwork implements AfterViewInit, OnDestroy {
  readonly heading = input.required<string>();
  readonly description = input.required<string>();
  readonly disclaimer = input.required<string>();

  readonly canvasEl = viewChild<ElementRef<HTMLCanvasElement>>('canvasEl');

  private runtime: GlobeRuntimeType | null = null;

  async ngAfterViewInit(): Promise<void> {
    if (prefersReducedMotion() || !supportsWebGL()) return;

    const canvas = this.canvasEl()?.nativeElement;
    if (!canvas) return;

    const { GlobeRuntime } = await import('../../three/globe-runtime');
    this.runtime = new GlobeRuntime({ canvas });
    this.runtime.start();
  }

  ngOnDestroy(): void {
    this.runtime?.dispose();
  }
}
