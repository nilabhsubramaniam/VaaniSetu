import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatusPill } from '../shared/components/status-pill/status-pill';
import { RevealOnScroll } from '../shared/directives/reveal-on-scroll.directive';
import { LANGUAGE_OPTIONS } from '../core/models/language.model';
import { TextTransformDemo } from './components/text-transform-demo/text-transform-demo';
import { HowItWorks } from './components/how-it-works/how-it-works';
import { DEMO_LANGUAGE_NODES, DEFAULT_DEMO_LANGUAGE_CODE } from './models/demo-language.model';
import { LandingI18nService } from './i18n/landing-i18n.service';
import { prefersReducedMotion as detectPrefersReducedMotion } from './three/environment-support';
import { HUD_PHASE_ORDER, HUD_PHASES, type HudPhase } from './three/hud-system';

interface Capability {
  readonly label: string;
  readonly description: string;
  /** Present only when the capability is aspirational, not built yet. */
  readonly note?: string;
}

const MIC_DEMO_HINT_MS = 3000;

// Mirrors the timing the hero's previous 3D demo cycle used — a preview
// of the real voice -> language -> understanding -> reply flow, not a
// live capability on this marketing page (the real thing is at
// /assistant). Kept as plain setTimeouts now that there's no Three.js
// runtime driving it.
const INBOUND_MS = 1000;
const LANGUAGE_HOLD_MS = 500;
const TRANSLATION_HOLD_MS = 500;
const OUTBOUND_MS = 1000;

/**
 * The public-facing entry point at `/`. The hero is a static reference
 * image (see `.hero`'s background in landing.page.scss) with the real,
 * working mic button and status panel layered on top; everything below
 * it — what the product is, supported languages, capabilities, privacy
 * stance, future direction — is static Phase 1 content.
 */
@Component({
  selector: 'app-landing-page',
  imports: [RouterLink, StatusPill, RevealOnScroll, TextTransformDemo, HowItWorks],
  templateUrl: './landing.page.html',
  styleUrl: './landing.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPage {
  private readonly i18n = inject(LandingI18nService);

  readonly copy = this.i18n.t;
  readonly languages = LANGUAGE_OPTIONS;
  readonly demoLanguages = DEMO_LANGUAGE_NODES;

  readonly waveformBars: readonly number[] = Array.from({ length: 12 }, (_, i) => i);
  readonly prefersReducedMotion = computed(() => detectPrefersReducedMotion());

  readonly selectedDemoLanguage = signal(DEFAULT_DEMO_LANGUAGE_CODE);
  readonly isMicDemoActive = signal(false);

  readonly hudPhaseOrder = HUD_PHASE_ORDER;
  readonly hudPhases = HUD_PHASES;
  readonly currentHudPhase = signal<HudPhase>('ready');

  private readonly hostEl = inject(ElementRef<HTMLElement>);

  private micDemoHintTimeout: ReturnType<typeof setTimeout> | null = null;
  private readonly hudPhaseTimeouts: ReturnType<typeof setTimeout>[] = [];

  readonly capabilities: readonly Capability[] = [
    {
      label: 'Voice interaction',
      description:
        'Talk to the assistant instead of typing, with a text fallback always available.',
    },
    {
      label: 'Multilingual understanding',
      description:
        'Built around Hindi and Hinglish first, with room for nine more Indian languages.',
    },
    {
      label: 'Natural code-switching',
      description:
        'Hinglish — Hindi and English mixed in one sentence — is a first-class case, not an edge case.',
    },
    {
      label: 'Local AI',
      description:
        'Speech recognition, language understanding, and speech synthesis run on your own hardware.',
      note: 'planned — not yet implemented',
    },
    {
      label: 'Knowledge retrieval',
      description:
        'Ground answers in your own documents instead of relying on memorized training data.',
      note: 'planned — not yet implemented',
    },
    {
      label: 'Extensible tools',
      description: 'Let the assistant take actions, not just answer questions.',
      note: 'planned — not yet implemented',
    },
    {
      label: 'Replaceable models',
      description:
        'No capability is permanently tied to one model — swap engines as better ones appear.',
    },
  ];

  readonly futureDirection: readonly string[] = [
    'More Indian languages, enabled one at a time as each meets its quality bar',
    'Better, benchmarked speech and language models — not just the first one that works',
    'Retrieval-augmented answers grounded in your own documents',
    'Specialized agents cooperating on a single request instead of one model doing everything',
    'Local and private deployments as the default, cloud as an explicit opt-in',
  ];

  selectDemoLanguage(code: string): void {
    this.selectedDemoLanguage.set(code);
  }

  triggerMicDemo(): void {
    this.isMicDemoActive.set(true);
    this.runHudPhaseSequence();

    if (this.micDemoHintTimeout) clearTimeout(this.micDemoHintTimeout);
    this.micDemoHintTimeout = setTimeout(() => {
      this.isMicDemoActive.set(false);
    }, MIC_DEMO_HINT_MS);
  }

  private runHudPhaseSequence(): void {
    this.hudPhaseTimeouts.forEach(clearTimeout);
    this.hudPhaseTimeouts.length = 0;

    this.currentHudPhase.set('voice');
    this.hudPhaseTimeouts.push(
      setTimeout(() => {
        this.currentHudPhase.set('language');
        this.hudPhaseTimeouts.push(
          setTimeout(() => {
            this.currentHudPhase.set('translation');
            this.hudPhaseTimeouts.push(
              setTimeout(() => {
                this.currentHudPhase.set('connection');
                this.hudPhaseTimeouts.push(
                  setTimeout(() => this.currentHudPhase.set('ready'), OUTBOUND_MS),
                );
              }, TRANSLATION_HOLD_MS),
            );
          }, LANGUAGE_HOLD_MS),
        );
      }, INBOUND_MS),
    );
  }

  scrollToNext(): void {
    const target = this.hostEl.nativeElement.querySelector('#how-it-works');
    target?.scrollIntoView({ behavior: this.prefersReducedMotion() ? 'auto' : 'smooth' });
  }
}
