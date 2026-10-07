export function resolveFeatureFlags(env: Record<string, unknown>) {
  const enabled = (key: string, fallback = false) => env[key] === undefined || env[key] === ''
    ? fallback : env[key] === 'true';
  return Object.freeze({
    accounts: enabled('VITE_ENABLE_ACCOUNTS'),
    samsungHealthImport: enabled('VITE_ENABLE_HEALTH_IMPORT'),
    testTools: enabled('VITE_ENABLE_TEST_TOOLS', env.DEV === true),
    diagnostics: enabled('VITE_ENABLE_DIAGNOSTICS', true),
    paceColors: enabled('VITE_ENABLE_PACE_COLORS', true),
  });
}
export const featureFlags = resolveFeatureFlags(import.meta.env);
