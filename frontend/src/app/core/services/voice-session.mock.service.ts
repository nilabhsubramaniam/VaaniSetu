import { Injectable, signal } from '@angular/core';
import type { VoiceState } from '../models/voice-state.model';
import { VoiceSessionService } from './voice-session.service';

/**
 * Phase 1 mock: a plain writable signal, no audio, no timers of its own.
 * Timers that drive `processing` → `responding` → `idle` live in
 * `ConversationMockService`, which is the thing that actually knows when a
 * (mock) reply is ready. This service only stores the current state.
 */
@Injectable({ providedIn: 'root' })
export class VoiceSessionMockService implements VoiceSessionService {
  private readonly _state = signal<VoiceState>('idle');
  readonly state = this._state.asReadonly();

  setState(next: VoiceState): void {
    this._state.set(next);
  }
}
