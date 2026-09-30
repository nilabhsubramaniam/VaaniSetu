import type { LandingCopy } from './landing-i18n.types';

// Titles are an editorial split, not a literal word-for-word mirror of the
// English lead/accent pairing — Hindi's verb-final order doesn't map onto
// the same two-word rhythm, so each line is composed to read naturally on
// its own rather than transliterating the English structure.
export const HI_COPY: LandingCopy = {
  hero: {
    eyebrow: 'आपका लोकल एआई वॉइस असिस्टेंट',
    titleLine1: { lead: 'स्वाभाविक रूप से', accent: 'बोलिए।' },
    titleLine2: { lead: 'भारत भर से', accent: 'जुड़िए।' },
    description:
      'वाणीसेतु भारत की भाषाओं के लिए एक आवाज़ी पुल बनने की दिशा में बन रहा है — आपको समझकर, सीधे आपके अपने डिवाइस पर जवाब देते हुए।',
    cta: 'वाणीसेतु आज़माएँ',
    micLabel: 'बोलना शुरू करें',
    micHintIdle: 'बोलने के लिए टैप करें',
    micHintListening: 'सुन रहा है…',
    outputLabel: 'असिस्टेंट का जवाब',
    visionNote: 'आज उपलब्ध: हिंदी, हिंग्लिश, मलयालम · हर भारतीय भाषा की दिशा में आगे बढ़ते हुए।',
    scrollCue: 'और देखने के लिए स्क्रॉल करें',
  },
  languageNodes: {
    heading: 'एक आवाज़, हर भाषा',
    description: 'वाणीसेतु भारत की भाषाओं और उससे आगे बढ़ने के लिए बनाया गया है।',
  },
  transform: {
    heading: 'जैसे बोलें, वैसे समझा जाए।',
    description: 'हिंदी, अंग्रेज़ी, या दोनों मिलाकर — वाणीसेतु आपके बोलने के तरीके को समझता है।',
  },
  howItWorks: {
    heading: 'यह कैसे काम करता है',
    steps: [
      {
        title: 'बोलिए',
        description: 'अपनी ही भाषा में स्वाभाविक रूप से बोलिए — कोई विशेष कमांड नहीं चाहिए।',
      },
      {
        title: 'समझना',
        description: 'वाणीसेतु आपकी भाषा पहचानकर, सिर्फ़ शब्द नहीं बल्कि आपकी मंशा समझता है।',
      },
      {
        title: 'जवाब',
        description: 'असिस्टेंट का जवाब, आपकी ही भाषा में, आवाज़ में सुनाई देता है।',
      },
    ],
  },
};
