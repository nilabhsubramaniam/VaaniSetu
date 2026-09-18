import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import type { LanguageCode } from '../models/language.model';

interface TranscribeResponseWire {
  readonly transcript: string;
}

/**
 * The `speech` capability's HTTP boundary: one call, no ongoing state, so
 * a plain injectable rather than the abstract-class + DI-token pattern
 * `ConversationService`/`VoiceSessionService` use for genuinely swappable,
 * stateful services (docs/DECISIONS.md ADR-009, ADR-017). There is exactly
 * one implementation and no second one is anticipated (AGENTS.md §6).
 *
 * Deliberately has no persistence side effect and knows nothing about
 * turns — the caller is expected to feed the returned transcript into the
 * existing `ConversationService.sendUserTurn`, unchanged
 * (docs/DECISIONS.md ADR-017).
 */
@Injectable({ providedIn: 'root' })
export class SpeechService {
  private readonly http = inject(HttpClient);

  /** Uploads audio and resolves with the recognized transcript. Throws
   * (via the returned promise) on any network or server failure, or if
   * nothing was recognized — callers route every case into the existing
   * `error` voice state. */
  async transcribe(audio: Blob, language: LanguageCode): Promise<string> {
    const url = `${environment.apiBaseUrl}/v1/speech/transcribe?language=${encodeURIComponent(language)}`;
    const response = await firstValueFrom(
      this.http.post<TranscribeResponseWire>(url, audio, {
        headers: { 'Content-Type': audio.type || 'application/octet-stream' },
      }),
    );
    return response.transcript;
  }
}
