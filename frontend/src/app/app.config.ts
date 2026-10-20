import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { routes } from './app.routes';
import { ConversationService } from './core/services/conversation.service';
import { ConversationRealService } from './core/services/conversation.real.service';
import { DocumentService } from './core/services/document.service';
import { DocumentRealService } from './core/services/document.real.service';
import { VoiceSessionService } from './core/services/voice-session.service';
import { VoiceSessionMockService } from './core/services/voice-session.mock.service';

/**
 * `ConversationService` now points at the real, HTTP-backed implementation
 * (Milestone 2b) — the Go backend it calls still uses `FakeLLMClient`
 * underneath (see docs/ROADMAP.md), so replies are still canned, but the
 * network round-trip is real. `DocumentService` points at the real
 * implementation too (Phase 7 Milestone 7f) — the document-upload API it
 * calls has been real since Milestone 7a, and chunking/embedding/retrieval
 * (7b-7d) are real and live-verified. `VoiceSessionService` stays on its
 * mock: it's a small local state holder with no backend counterpart to
 * swap to (see docs/DECISIONS.md ADR-009 — only these `useClass` lines
 * change per milestone, never the components).
 */
export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideHttpClient(),
    provideRouter(routes),
    { provide: ConversationService, useClass: ConversationRealService },
    { provide: DocumentService, useClass: DocumentRealService },
    { provide: VoiceSessionService, useClass: VoiceSessionMockService },
  ],
};
