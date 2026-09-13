/**
 * Production environment defaults.
 *
 * `apiBaseUrl` is a placeholder for the future Go backend (Phase 2+).
 * `useMockData` stays `false` here so a production build never silently
 * falls back to mock data if a real API integration is added later.
 * Phase 1 has no code path that reads `apiBaseUrl` yet.
 */
export const environment = {
  production: true,
  useMockData: false,
  apiBaseUrl: '/api',
};
