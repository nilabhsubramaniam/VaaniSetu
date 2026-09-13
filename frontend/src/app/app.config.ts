import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { ConversationService } from './core/services/conversation.service';
import { ConversationMockService } from './core/services/conversation.mock.service';
import { VoiceSessionService } from './core/services/voice-session.service';
import { VoiceSessionMockService } from './core/services/voice-session.mock.service';

/**
 * `ConversationService` and `VoiceSessionService` are provided as the mock
 * implementations for the whole of Phase 1 (see docs/DECISIONS.md ADR-009).
 * Phase 2 replaces these two `useClass` lines with a real, backend-backed
 * implementation — no component changes required.
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    { provide: ConversationService, useClass: ConversationMockService },
    { provide: VoiceSessionService, useClass: VoiceSessionMockService },
  ],
};
