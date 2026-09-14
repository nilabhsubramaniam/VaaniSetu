import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';
import { StatusPill } from '../shared/components/status-pill/status-pill';
import { RevealOnScroll } from '../shared/directives/reveal-on-scroll.directive';
import { LANGUAGE_OPTIONS } from '../core/models/language.model';

interface PipelineStep {
  readonly id: 'mic' | 'vad' | 'stt' | 'lang' | 'ai' | 'rag' | 'tts' | 'response';
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
 * The public-facing entry point at `/`. Purely presentational and static —
 * no service injection, no network calls, no mock-data wiring. Its job is
 * to explain the product to a new visitor and hand off to the real (mocked)
 * interaction at `/assistant`, not to demonstrate any functionality itself.
 *
 * Deliberately kept as one component rather than split into per-section
 * components: every section here has exactly one consumer (this page) and
 * no independent logic, so a split would be fragmentation without reuse.
 */
@Component({
  selector: 'app-landing-page',
  imports: [RouterLink, StatusPill, RevealOnScroll],
  templateUrl: './landing.page.html',
  styleUrl: './landing.page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LandingPage {
  readonly languages = LANGUAGE_OPTIONS;

  readonly pipelineSteps: readonly PipelineStep[] = [
    { id: 'mic', label: 'Microphone', description: 'You speak, on your own device.' },
    {
      id: 'vad',
      label: 'Voice activity detection',
      description: 'Notices when you start and stop talking.',
    },
    { id: 'stt', label: 'Speech-to-text', description: 'Turns speech into a transcript.' },
    {
      id: 'lang',
      label: 'Language detection',
      description: 'Tags Hindi, Hinglish, or another language, per turn.',
    },
    { id: 'ai', label: 'Local AI', description: 'A local model reasons about what you said.' },
    {
      id: 'rag',
      label: 'RAG / tools',
      description: 'Optionally grounds the answer in your documents or an action.',
    },
    { id: 'tts', label: 'Text-to-speech', description: 'Turns the reply back into speech.' },
    { id: 'response', label: 'Voice response', description: 'You hear the answer.' },
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
}
