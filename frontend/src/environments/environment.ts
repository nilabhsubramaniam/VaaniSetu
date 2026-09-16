/**
 * Production environment defaults.
 *
 * `apiBaseUrl` is read by `ConversationRealService` for both the Go
 * backend's endpoints (Milestone 2b's frontend integration); expected to be
 * served from the same origin in production, hence the relative path.
 * `useMockData` stays `false` here so a production build never silently
 * falls back to mock data.
 */
export const environment = {
  production: true,
  useMockData: false,
  apiBaseUrl: '/api',
};
