import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject } from '@angular/core';
import type { LanguageCode } from '../../core/models/language.model';
import { ConversationService } from '../../core/services/conversation.service';
import { SettingsStore } from '../../core/services/settings.store';
import { VoiceSessionService } from '../../core/services/voice-session.service';

/** How long the mic "listens" before auto-stopping, simulating VAD endpointing. */
const AUTO_STOP_DELAY_MS = 1500;

/**
 * What the mic pretends to have heard, per language. There is no real ASR
 * in Phase 1 (docs/ROADMAP.md) — this only exists so pressing the mic
 * produces a plausible Hindi/Hinglish user turn to demonstrate the full
 * idle → listening → processing → responding cycle end to end.
 */
const CANNED_TRANSCRIPTS: Record<LanguageCode, string> = {
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

@Component({
  selector: 'app-mic-button',
  templateUrl: './mic-button.html',
  styleUrl: './mic-button.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MicButton {
  private readonly voiceSession = inject(VoiceSessionService);
  private readonly conversation = inject(ConversationService);
  private readonly settings = inject(SettingsStore);
  private readonly destroyRef = inject(DestroyRef);

  private autoStopHandle: ReturnType<typeof setTimeout> | undefined;

  readonly state = this.voiceSession.state;
  readonly isListening = computed(() => this.state() === 'listening');
  readonly isBusy = computed(() => this.state() === 'processing' || this.state() === 'responding');

  constructor() {
    this.destroyRef.onDestroy(() => this.clearAutoStop());
  }

  onPress(): void {
    if (this.isBusy()) {
      return; // a reply is already in flight; wait for it to finish
    }

    if (this.isListening()) {
      this.stopListeningAndSend();
      return;
    }

    this.voiceSession.setState('listening');
    this.autoStopHandle = setTimeout(() => this.stopListeningAndSend(), AUTO_STOP_DELAY_MS);
  }

  private stopListeningAndSend(): void {
    this.clearAutoStop();
    if (this.state() !== 'listening') {
      return;
    }
    const language = this.settings.preferredLanguage();
    const transcript = CANNED_TRANSCRIPTS[language] ?? CANNED_TRANSCRIPTS['en'];
    this.conversation.sendUserTurn(transcript, language);
  }

  private clearAutoStop(): void {
    if (this.autoStopHandle !== undefined) {
      clearTimeout(this.autoStopHandle);
      this.autoStopHandle = undefined;
    }
  }
}
