import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { authConfiguration } from './config';
import { featureFlags } from '../config/featureFlags';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
function initialize(): { client: SupabaseClient | null; error: string } {
  if (!featureFlags.accounts) return { client: null, error: '' };
  try {
    const config = authConfiguration(url, key);
    return { client: config ? createClient(config.url, config.key, {
      auth: { flowType: 'pkce', detectSessionInUrl: false, persistSession: true, autoRefreshToken: true },
    }) : null, error: '' };
  } catch (e) { return { client: null, error: e instanceof Error ? e.message : 'Invalid account configuration.' }; }
}
const initialized = initialize();
export const authClient = initialized.client;
export const authConfigurationError = initialized.error;

const exchanges = new WeakMap<SupabaseClient, { code: string; promise: ReturnType<SupabaseClient['auth']['exchangeCodeForSession']> }>();
export function exchangeAuthCode(client: SupabaseClient, code: string) {
  const prior = exchanges.get(client);
  if (prior?.code === code) return prior.promise;
  const promise = client.auth.exchangeCodeForSession(code);
  exchanges.set(client, { code, promise });
  return promise;
}

export const authRedirect = () => Capacitor.isNativePlatform()
  ? 'com.plaivang.questbound://auth/callback'
  : `${window.location.origin}${window.location.pathname}`;

export function authCallbackCode(raw: string): string | null {
  const target = new URL(raw);
  const expected = new URL(authRedirect());
  if (target.protocol !== expected.protocol || target.host !== expected.host || target.pathname !== expected.pathname) return null;
  const error = target.searchParams.get('error_description') ?? target.searchParams.get('error');
  if (error) throw new Error(error);
  return target.searchParams.get('code');
}
