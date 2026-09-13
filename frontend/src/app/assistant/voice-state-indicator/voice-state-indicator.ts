import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { StatusPill, type StatusPillTone } from '../../shared/components/status-pill/status-pill';
import { VOICE_STATE_DESCRIPTIONS } from '../../core/models/voice-state.model';
import { VoiceSessionService } from '../../core/services/voice-session.service';

const TONE_BY_STATE: Record<string, StatusPillTone> = {
  idle: 'idle',
  listening: 'accent',
  processing: 'processing',
  responding: 'responding',
  error: 'error',
};

/**
 * Renders the current `VoiceState` as a label and announces every change
 * to assistive technology via an `aria-live` region — the app is
 * voice-first, so a silent state change would leave screen-reader users
 * with no signal at all that anything happened.
 */
@Component({
  selector: 'app-voice-state-indicator',
  imports: [StatusPill],
  templateUrl: './voice-state-indicator.html',
  styleUrl: './voice-state-indicator.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VoiceStateIndicator {
  private readonly voiceSession = inject(VoiceSessionService);

  readonly state = this.voiceSession.state;
  readonly description = computed(() => VOICE_STATE_DESCRIPTIONS[this.state()]);
  readonly tone = computed<StatusPillTone>(() => TONE_BY_STATE[this.state()] ?? 'neutral');
}
