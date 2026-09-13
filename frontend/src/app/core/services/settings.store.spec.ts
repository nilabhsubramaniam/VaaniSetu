import { SettingsStore } from './settings.store';

describe('SettingsStore', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to Hindi when nothing is stored', () => {
    const store = new SettingsStore();
    expect(store.preferredLanguage()).toBe('hi');
  });

  it('updates the signal and persists the choice', () => {
    const store = new SettingsStore();
    store.setPreferredLanguage('hinglish');

    expect(store.preferredLanguage()).toBe('hinglish');
    expect(localStorage.getItem('vaanisetu.settings.preferredLanguage')).toBe('hinglish');
  });

  it('reads a previously stored preference on construction', () => {
    localStorage.setItem('vaanisetu.settings.preferredLanguage', 'hinglish');
    const store = new SettingsStore();
    expect(store.preferredLanguage()).toBe('hinglish');
  });
});
