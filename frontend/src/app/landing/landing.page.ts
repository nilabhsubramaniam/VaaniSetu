import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatusPill } from '../shared/components/status-pill/status-pill';
import { RevealOnScroll } from '../shared/directives/reveal-on-scroll.directive';
import { HeroScene } from './hero-scene/hero-scene';
import { heroStoryStageWeights } from './hero-story-progress';
import { LANGUAGE_OPTIONS } from '../core/models/language.model';

interface StoryStage {
  readonly id: 'listen' | 'process' | 'think' | 'respond';
  readonly label: string;
  readonly description: string;
}

interface Capability {
  readonly label: string;
  readonly description: string;
  /** Present only when the capability is aspirational, not built yet. */
  readonly note?: string;
}

/**
 * The public-facing entry point at `/`. Purely presentational — no
 * service injection, no network calls, no mock-data wiring. Its job is
 * to explain the product to a new visitor and hand off to the real (mocked)
 * interaction at `/assistant`, not to demonstrate any functionality itself.
 * The `prefersReducedMotion`/scroll-progress logic below is a leaf UI
 * capability check, the same category `RevealOnScroll` already makes
 * inline — not the kind of service dependency that doc comment is about.
 *
 * Deliberately kept as one component rather than split into per-section
 * components: every section here has exactly one consumer (this page) and
 * no independent logic, so a split would be fragmentation without reuse.
 */
@Component({
  selector: 'app-landing-page',
  imports: [RouterLink, StatusPill, RevealOnScroll, HeroScene],
  templateUrl: './landing.page.html',
  styleUrl: './landing.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPage implements AfterViewInit {
  private readonly heroStoryRef = viewChild<ElementRef<HTMLElement>>('heroStory');
  private readonly destroyRef = inject(DestroyRef);

  readonly languages = LANGUAGE_OPTIONS;

  readonly prefersReducedMotion =
    typeof window !== 'undefined' &&
    !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  /** 0..1 across the hero's scroll-driven story — see
   * hero-story-progress.ts. Stays 0 (and is never updated by a scroll
   * listener at all) when prefersReducedMotion is true: in that case the
   * template renders the story as a normal, always-visible stacked list
   * instead of a scroll-pinned sequence, so there is nothing for this
   * value to drive. */
  readonly storyProgress = signal(0);

  readonly storyStages: readonly StoryStage[] = [
    {
      id: 'listen',
      label: 'Listen',
      description:
        'You speak. The microphone and voice-activity detection capture it, on your own device.',
    },
    {
      id: 'process',
      label: 'Process',
      description:
        'Speech becomes text, tagged with its language and script — Hindi, Hinglish, or one of nine more.',
    },
    {
      id: 'think',
      label: 'Think',
      description:
        'A local language model reasons about what you said, optionally grounded in your own documents.',
    },
    {
      id: 'respond',
      label: 'Respond',
      description:
        'The reply is spoken back to you, synthesized locally, never leaving your machine.',
    },
  ];

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

  ngAfterViewInit(): void {
    if (this.prefersReducedMotion) {
      return;
    }

    const updateProgress = () => {
      const host = this.heroStoryRef()?.nativeElement;
      if (!host) {
        return;
      }
      const rect = host.getBoundingClientRect();
      const viewportHeight = window.innerHeight || 1;
      const scrollable = rect.height - viewportHeight;
      const raw = scrollable > 0 ? -rect.top / scrollable : 0;
      this.storyProgress.set(Math.min(Math.max(raw, 0), 1));
    };

    window.addEventListener('scroll', updateProgress, { passive: true });
    updateProgress();
    this.destroyRef.onDestroy(() => window.removeEventListener('scroll', updateProgress));
  }

  /** Opacity for stage caption `index` — always 1 with reduced motion
   * (every stage stacked and visible, per the template), otherwise
   * crossfaded from the same shared weights the 3D scene blends by, so
   * the visible caption always matches what the scene is doing.
   *
   * Rescaled, not used raw: the two interior stages ("process", "think")
   * always have two neighbors overlapping (see
   * hero-story-progress.spec.ts), so their weight tops out at 0.75, never
   * 1 — used directly, their captions would never reach full opacity even
   * at their own peak. Dividing by that same 0.75 ceiling (and clamping,
   * since the edge stages' own peak of 1 would otherwise overshoot) makes
   * every stage's caption reach fully readable at its own peak moment. */
  captionOpacity(index: number): number {
    if (this.prefersReducedMotion) {
      return 1;
    }
    const weight = heroStoryStageWeights(this.storyProgress())[index];
    return Math.min(1, weight / 0.75);
  }

  /** Fades the "scroll to see how it listens" hint out quickly once the
   * visitor has actually started scrolling — gone by the end of the
   * "listen" stage, not lingering through the rest of the story. */
  scrollHintOpacity(): number {
    return Math.max(0, 1 - this.storyProgress() * 4);
  }
}
