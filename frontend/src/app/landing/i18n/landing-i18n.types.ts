/** A headline split into a plain lead and an emphasized accent word/phrase. */
export interface HeroTitleLine {
  readonly lead: string;
  readonly accent: string;
}

export interface LandingCopy {
  readonly hero: {
    readonly eyebrow: string;
    readonly titleLine1: HeroTitleLine;
    readonly titleLine2: HeroTitleLine;
    readonly description: string;
    readonly cta: string;
    readonly micLabel: string;
    readonly micHintIdle: string;
    readonly micHintListening: string;
    readonly outputLabel: string;
    readonly fallbackDescription: string;
    readonly infoCard: string;
    readonly scrollCue: string;
  };
  readonly languageNodes: {
    readonly heading: string;
    readonly description: string;
  };
  readonly transform: {
    readonly heading: string;
    readonly description: string;
  };
  readonly howItWorks: {
    readonly heading: string;
    readonly steps: readonly { readonly title: string; readonly description: string }[];
  };
  readonly globalNetwork: {
    readonly heading: string;
    readonly description: string;
    readonly disclaimer: string;
  };
}
