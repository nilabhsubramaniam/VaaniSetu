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

  it('defaults auto-detect to off when nothing is stored', () => {
    const store = new SettingsStore();
    expect(store.autoDetectLanguage()).toBe(false);
  });

  it('updates the auto-detect signal and persists the choice', () => {
    const store = new SettingsStore();
    store.setAutoDetectLanguage(true);

    expect(store.autoDetectLanguage()).toBe(true);
    expect(localStorage.getItem('vaanisetu.settings.autoDetectLanguage')).toBe('true');
  });

  it('reads a previously stored auto-detect preference on construction', () => {
    localStorage.setItem('vaanisetu.settings.autoDetectLanguage', 'true');
    const store = new SettingsStore();
    expect(store.autoDetectLanguage()).toBe(true);
  });

  it('effectiveChatLanguage() is the pinned language when auto-detect is off', () => {
    const store = new SettingsStore();
    store.setPreferredLanguage('hinglish');
    expect(store.effectiveChatLanguage()).toBe('hinglish');
  });

  it('effectiveChatLanguage() is "auto" when auto-detect is on, regardless of the pin', () => {
    const store = new SettingsStore();
    store.setPreferredLanguage('hinglish');
    store.setAutoDetectLanguage(true);
    expect(store.effectiveChatLanguage()).toBe('auto');
  });

  it('turning auto-detect off restores the last concrete pin', () => {
    const store = new SettingsStore();
    store.setPreferredLanguage('ml');
    store.setAutoDetectLanguage(true);
    store.setAutoDetectLanguage(false);

    expect(store.effectiveChatLanguage()).toBe('ml');
    expect(store.preferredLanguage()).toBe('ml');
  });
});
