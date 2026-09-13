/**
 * Development environment defaults.
 *
 * `useMockData: true` is the only thing Phase 1 actually reads (indirectly,
 * via which service provider is wired up in `app.config.ts`). `apiBaseUrl`
 * is unused until a real backend client exists.
 */
export const environment = {
  production: false,
  useMockData: true,
  apiBaseUrl: 'http://localhost:8080/api',
};
