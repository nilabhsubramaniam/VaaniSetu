export type HudPhase = 'ready' | 'voice' | 'language' | 'translation' | 'connection';

interface HudPhaseInfo {
  readonly label: string;
  readonly dotColor: string;
}

export const HUD_PHASES: Record<Exclude<HudPhase, 'ready'>, HudPhaseInfo> = {
  voice: { label: 'VOICE INPUT', dotColor: '#3fb56a' },
  language: { label: 'LANGUAGE DETECTED', dotColor: '#3f96b0' },
  translation: { label: 'TRANSLATION ROUTE', dotColor: '#7a5fc4' },
  connection: { label: 'CONNECTION ACTIVE', dotColor: '#b9812e' },
};

export const HUD_PHASE_ORDER: readonly Exclude<HudPhase, 'ready'>[] = [
  'voice',
  'language',
  'translation',
  'connection',
];
