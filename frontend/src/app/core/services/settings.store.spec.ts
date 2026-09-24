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

  it('defaults to the female voice when nothing is stored', () => {
    const store = new SettingsStore();
    expect(store.preferredVoice()).toBe('female');
  });

  it('updates the voice signal and persists the choice', () => {
    const store = new SettingsStore();
    store.setPreferredVoice('male');

    expect(store.preferredVoice()).toBe('male');
    expect(localStorage.getItem('vaanisetu.settings.preferredVoice')).toBe('male');
  });

  it('reads a previously stored voice preference on construction', () => {
    localStorage.setItem('vaanisetu.settings.preferredVoice', 'male');
    const store = new SettingsStore();
    expect(store.preferredVoice()).toBe('male');
  });
});
