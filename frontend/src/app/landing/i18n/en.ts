import type { LandingCopy } from './landing-i18n.types';

export const EN_COPY: LandingCopy = {
  hero: {
    eyebrow: 'Your local AI voice assistant',
    titleLine1: { lead: 'Speak', accent: 'naturally.' },
    titleLine2: { lead: 'Connect', accent: 'across India.' },
    description:
      'VaaniSetu is being built as your voice bridge across India’s languages — understanding and replying to you, entirely on your own device.',
    cta: 'Try VaaniSetu',
    micLabel: 'Start speaking',
    micHintIdle: 'Tap to speak',
    micHintListening: 'Listening…',
    outputLabel: 'Assistant’s reply',
    visionNote: 'Live today: Hindi, Hinglish, Malayalam · Building toward every Indian language.',
    scrollCue: 'Scroll to explore',
  },
  languageNodes: {
    heading: 'One voice, every language',
    description: 'VaaniSetu is built to grow across India’s languages and beyond.',
  },
  transform: {
    heading: 'Say it your way. Understood as you meant it.',
    description:
      'Hindi, English, or both mixed together — VaaniSetu follows how you actually speak.',
  },
  howItWorks: {
    heading: 'How it works',
    steps: [
      {
        title: 'Speak',
        description: 'Talk naturally in your own language — no commands or special phrasing.',
      },
      {
        title: 'Understand',
        description:
          'VaaniSetu detects your language and understands your intent, not just the words.',
      },
      {
        title: 'Reply',
        description: 'The assistant answers back spoken aloud, in the language you spoke.',
      },
    ],
  },
};
