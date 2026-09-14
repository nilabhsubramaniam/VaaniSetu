import type { LanguageCode } from './language.model';

/**
 * One example utterance per language. There is no real ASR in Phase 1
 * (docs/ROADMAP.md), so this serves two purposes that both need the exact
 * same content rather than two copies of it:
 *
 * - `MicButton` uses it as what the mic "pretends to have heard" once its
 *   mock listening window ends.
 * - `ConversationView`'s empty state shows a few of these as clickable
 *   examples, teaching a new user what they can ask without implying any
 *   functionality beyond the existing mock `sendUserTurn` pipeline.
 */
export const EXAMPLE_PROMPTS: Record<LanguageCode, string> = {
  hi: 'आज मौसम कैसा है?',
  hinglish: 'Bhai, mujhe kal ka reminder set karna hai.',
  en: "What's on my schedule today?",
  bn: 'আজকের আবহাওয়া কেমন?',
  gu: 'આજનું હવામાન કેવું છે?',
  mr: 'आज हवामान कसे आहे?',
  ta: 'இன்று வானிலை எப்படி இருக்கிறது?',
  te: 'ఈరోజు వాతావరణం ఎలా ఉంది?',
  kn: 'ಇಂದಿನ ಹವಾಮಾನ ಹೇಗಿದೆ?',
  ml: 'ഇന്നത്തെ കാലാവസ്ഥ എങ്ങനെയുണ്ട്?',
  pa: 'ਅੱਜ ਦਾ ਮੌਸਮ ਕਿਵੇਂ ਹੈ?',
  or: 'ଆଜିର ପାଣିପାଗ କେମିତି?',
};
