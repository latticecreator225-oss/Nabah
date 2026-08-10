/**
 * Nabah · Lightweight logger
 *
 * Replaces silent `catch {}` blocks in important flows (prayer times, user
 * load, notifications, sunnah fetches) so real failures are traceable in dev
 * instead of vanishing. In production builds it stays quiet by default.
 */
export function logError(scope: string, e: unknown): void {
  const msg = e instanceof Error ? e.message : String(e);
  // __DEV__ is a global injected by the React Native / Expo runtime.
  if (typeof __DEV__ === 'undefined' || __DEV__) {
    // eslint-disable-next-line no-console
    console.warn(`[nabah:${scope}]`, msg);
  }
}
