import { expect, it } from 'vitest';
import { resolveFeatureFlags } from './featureFlags';
it('keeps accounts, health import and production testing tools disabled by default', () => {
  expect(resolveFeatureFlags({})).toEqual({ accounts: false, samsungHealthImport: false, testTools: false, diagnostics: true, paceColors: true });
  expect(resolveFeatureFlags({ DEV: true }).testTools).toBe(true);
  expect(resolveFeatureFlags({ VITE_ENABLE_ACCOUNTS: 'true' }).accounts).toBe(true);
  expect(resolveFeatureFlags({ VITE_ENABLE_ACCOUNTS: 'TRUE' }).accounts).toBe(false);
  expect(resolveFeatureFlags({ VITE_ENABLE_PACE_COLORS: 'false' }).paceColors).toBe(false);
});
