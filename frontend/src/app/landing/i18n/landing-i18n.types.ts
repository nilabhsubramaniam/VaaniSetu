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
    /** The honest "today vs. vision" signal, same spirit as the
     * "Available now / Coming next" language section further down. */
    readonly visionNote: string;
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
}
