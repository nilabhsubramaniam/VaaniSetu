import type { LandingCopy } from './landing-i18n.types';

export const EN_COPY: LandingCopy = {
  hero: {
    eyebrow: 'Real-time voice translation',
    titleLine1: { lead: 'Speak', accent: 'naturally.' },
    titleLine2: { lead: 'Connect', accent: 'globally.' },
    description:
      'VaaniSetu listens in your language and speaks back in theirs — no typing, no delay, no barrier.',
    cta: 'Try VaaniSetu',
    micLabel: 'Start speaking',
    micHintIdle: 'Tap to speak',
    micHintListening: 'Listening…',
    outputLabel: 'Translated output',
    fallbackDescription:
      'A voice bridge between languages: speak in yours, and be understood in anyone else’s.',
    infoCard: 'Global communication, made simple.',
    scrollCue: 'Scroll to explore',
  },
  languageNodes: {
    heading: 'One voice, every language',
    description: 'VaaniSetu is built to grow across India’s languages and beyond.',
  },
  transform: {
    heading: 'Say it once. Understood everywhere.',
    description: 'Your words carry their meaning across the language barrier, instantly.',
  },
  howItWorks: {
    heading: 'How it works',
    steps: [
      {
        title: 'Speak',
        description: 'Talk naturally in your own language — no commands or special phrasing.',
      },
      {
        title: 'Translate',
        description: 'VaaniSetu detects the language and translates meaning, not just words.',
      },
      {
        title: 'Connect',
        description: 'The response comes back spoken aloud, in the language your listener uses.',
      },
    ],
  },
  globalNetwork: {
    heading: 'A growing network of languages',
    description: 'Every added language brings VaaniSetu closer to a world without a voice barrier.',
    disclaimer: 'Illustrative network — not a live user map.',
  },
};
