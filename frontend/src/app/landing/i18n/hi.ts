import type { LandingCopy } from './landing-i18n.types';

// Titles are an editorial split, not a literal word-for-word mirror of the
// English lead/accent pairing — Hindi's verb-final order doesn't map onto
// the same two-word rhythm, so each line is composed to read naturally on
// its own rather than transliterating the English structure.
export const HI_COPY: LandingCopy = {
  hero: {
    eyebrow: 'रीयल-टाइम आवाज़ अनुवाद',
    titleLine1: { lead: 'स्वाभाविक रूप से', accent: 'बोलिए।' },
    titleLine2: { lead: 'दुनिया से', accent: 'जुड़िए।' },
    description:
      'वाणीसेतु आपकी भाषा में सुनता है और सामने वाले की भाषा में जवाब देता है — बिना टाइप किए, बिना देरी के।',
    cta: 'वाणीसेतु आज़माएँ',
    micLabel: 'बोलना शुरू करें',
    micHintIdle: 'बोलने के लिए टैप करें',
    micHintListening: 'सुन रहा है…',
    outputLabel: 'अनुवादित आउटपुट',
    fallbackDescription:
      'भाषाओं के बीच एक आवाज़ी पुल: अपनी भाषा में बोलिए, और किसी और की भाषा में समझे जाइए।',
    infoCard: 'वैश्विक संवाद, अब आसान।',
    scrollCue: 'और देखने के लिए स्क्रॉल करें',
  },
  languageNodes: {
    heading: 'एक आवाज़, हर भाषा',
    description: 'वाणीसेतु भारत की भाषाओं और उससे आगे बढ़ने के लिए बनाया गया है।',
  },
  transform: {
    heading: 'एक बार कहिए। हर जगह समझा जाए।',
    description: 'आपके शब्द भाषा की दीवार पार करके, तुरंत अपना अर्थ पहुँचाते हैं।',
  },
  howItWorks: {
    heading: 'यह कैसे काम करता है',
    steps: [
      {
        title: 'बोलिए',
        description: 'अपनी ही भाषा में स्वाभाविक रूप से बोलिए — कोई विशेष कमांड नहीं चाहिए।',
      },
      {
        title: 'अनुवाद',
        description: 'वाणीसेतु भाषा पहचानकर शब्दों का नहीं, अर्थ का अनुवाद करता है।',
      },
      {
        title: 'जुड़ाव',
        description: 'जवाब सामने वाले की भाषा में, आवाज़ में सुनाई देता है।',
      },
    ],
  },
  globalNetwork: {
    heading: 'भाषाओं का बढ़ता नेटवर्क',
    description: 'हर नई भाषा वाणीसेतु को एक ऐसी दुनिया के करीब ले जाती है जहाँ भाषा रुकावट न बने।',
    disclaimer: 'सांकेतिक नेटवर्क — यह वास्तविक उपयोगकर्ता मानचित्र नहीं है।',
  },
};
