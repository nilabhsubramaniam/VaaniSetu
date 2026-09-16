/**
 * Development environment defaults.
 *
 * `apiBaseUrl` is read by `ConversationRealService` for both the Go
 * backend's endpoints (Milestone 2b's frontend integration); points at the
 * local backend's default port (`ng serve` + `make run` side by side).
 * `useMockData` remains unread by any service — which provider is real vs.
 * mock is controlled entirely by `app.config.ts`'s `useClass` lines
 * (ADR-009), not by this flag.
 */
export const environment = {
  production: false,
  useMockData: true,
  apiBaseUrl: 'http://localhost:8080/api',
};
