import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatusPill } from '../shared/components/status-pill/status-pill';
import { RevealOnScroll } from '../shared/directives/reveal-on-scroll.directive';
import { LANGUAGE_OPTIONS } from '../core/models/language.model';
import { HeroExperience } from './components/hero-experience/hero-experience';
import { TextTransformDemo } from './components/text-transform-demo/text-transform-demo';
import { HowItWorks } from './components/how-it-works/how-it-works';
import { GlobalNetwork } from './components/global-network/global-network';
import { DEMO_LANGUAGE_NODES, DEFAULT_DEMO_LANGUAGE_CODE } from './models/demo-language.model';
import { LandingI18nService } from './i18n/landing-i18n.service';
import { prefersReducedMotion as detectPrefersReducedMotion } from './three/environment-support';

interface Capability {
  readonly label: string;
  readonly description: string;
  /** Present only when the capability is aspirational, not built yet. */
  readonly note?: string;
}

const MIC_DEMO_HINT_MS = 3000;

/**
 * The public-facing entry point at `/`. The hero is a genuinely interactive
 * 3D communication ecosystem (see `components/hero-experience`); everything
 * below it — what the product is, supported languages, capabilities,
 * privacy stance, future direction — is static Phase 1 content, unchanged
 * by the hero redesign.
 */
@Component({
  selector: 'app-landing-page',
  imports: [
    RouterLink,
    StatusPill,
    RevealOnScroll,
    HeroExperience,
    TextTransformDemo,
    HowItWorks,
    GlobalNetwork,
  ],
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

  readonly heroExperienceRef = viewChild(HeroExperience);
  private readonly hostEl = inject(ElementRef<HTMLElement>);

  private micDemoHintTimeout: ReturnType<typeof setTimeout> | null = null;

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
    this.heroExperienceRef()?.triggerDemo();
    this.isMicDemoActive.set(true);

    if (this.micDemoHintTimeout) clearTimeout(this.micDemoHintTimeout);
    this.micDemoHintTimeout = setTimeout(() => {
      this.isMicDemoActive.set(false);
    }, MIC_DEMO_HINT_MS);
  }

  scrollToNext(): void {
    const target = this.hostEl.nativeElement.querySelector('#how-it-works');
    target?.scrollIntoView({ behavior: this.prefersReducedMotion() ? 'auto' : 'smooth' });
  }
}
