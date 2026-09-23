import { HUD_PHASE_ORDER, HUD_PHASES } from './hud-system';

describe('hud-system', () => {
  it('defines info for every phase in the order list', () => {
    for (const phase of HUD_PHASE_ORDER) {
      expect(HUD_PHASES[phase]).toBeDefined();
      expect(HUD_PHASES[phase].label.length).toBeGreaterThan(0);
    }
  });

  it('orders phases as voice, language, translation, connection', () => {
    expect(HUD_PHASE_ORDER).toEqual(['voice', 'language', 'translation', 'connection']);
  });
});
