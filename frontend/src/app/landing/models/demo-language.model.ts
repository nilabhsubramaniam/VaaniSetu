/**
 * Decorative languages shown as orbiting nodes in the hero's 3D scene.
 *
 * Deliberately a SEPARATE concept from `LanguageCode`/`LANGUAGE_OPTIONS`
 * (the real, functional language set the assistant supports): this list
 * exists purely to make the hero feel like a rich, many-language product,
 * and includes languages VaaniSetu doesn't actually support yet — but,
 * per the project's India focus, only Indian languages (English included,
 * since it's one of India's own widely-used languages). Never wire this
 * into `SettingsStore` — selecting a demo node changes only which
 * greeting the hero plays, not the app's language preference.
 */
export interface DemoLanguageNode {
  readonly code: string;
  readonly label: string;
  readonly englishName: string;
  readonly greeting: string;
  readonly flag: string;
}

export const DEMO_LANGUAGE_NODES: readonly DemoLanguageNode[] = [
  { code: 'en', label: 'English', englishName: 'English', greeting: 'Hello', flag: '🇮🇳' },
  { code: 'hi', label: 'हिन्दी', englishName: 'Hindi', greeting: 'नमस्ते', flag: '🇮🇳' },
  { code: 'ta', label: 'தமிழ்', englishName: 'Tamil', greeting: 'வணக்கம்', flag: '🇮🇳' },
  { code: 'bn', label: 'বাংলা', englishName: 'Bengali', greeting: 'নমস্কার', flag: '🇮🇳' },
  { code: 'te', label: 'తెలుగు', englishName: 'Telugu', greeting: 'నమస్కారం', flag: '🇮🇳' },
  { code: 'mr', label: 'मराठी', englishName: 'Marathi', greeting: 'नमस्कार', flag: '🇮🇳' },
  { code: 'gu', label: 'ગુજરાતી', englishName: 'Gujarati', greeting: 'નમસ્તે', flag: '🇮🇳' },
  { code: 'pa', label: 'ਪੰਜਾਬੀ', englishName: 'Punjabi', greeting: 'ਸਤ ਸ੍ਰੀ ਅਕਾਲ', flag: '🇮🇳' },
  { code: 'kn', label: 'ಕನ್ನಡ', englishName: 'Kannada', greeting: 'ನಮಸ್ಕಾರ', flag: '🇮🇳' },
  { code: 'or', label: 'ଓଡ଼ିଆ', englishName: 'Odia', greeting: 'ନମସ୍କାର', flag: '🇮🇳' },
];

export const DEFAULT_DEMO_LANGUAGE_CODE = 'en';
