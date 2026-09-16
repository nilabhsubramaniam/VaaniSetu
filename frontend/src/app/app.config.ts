import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { ConversationService } from './core/services/conversation.service';
import { ConversationRealService } from './core/services/conversation.real.service';
import { VoiceSessionService } from './core/services/voice-session.service';
import { VoiceSessionMockService } from './core/services/voice-session.mock.service';

/**
 * `ConversationService` now points at the real, HTTP-backed implementation
 * (Milestone 2b) — the Go backend it calls still uses `FakeLLMClient`
 * underneath (see docs/ROADMAP.md), so replies are still canned, but the
 * network round-trip is real. `VoiceSessionService` stays on its mock: it's
 * a small local state holder with no backend counterpart to swap to (see
 * docs/DECISIONS.md ADR-009 — only these `useClass` lines change per
 * milestone, never the components).
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes),
    { provide: ConversationService, useClass: ConversationRealService },
    { provide: VoiceSessionService, useClass: VoiceSessionMockService },
  ],
};
