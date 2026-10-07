import { afterEach, expect, it, vi } from 'vitest';
import { Capacitor } from '@capacitor/core';
import { authConfiguration } from './config';
import { authCallbackCode, authClient, exchangeAuthCode } from './client';
import { AuthError, createClient } from '@supabase/supabase-js';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it('never creates an auth client with the account feature disabled', () => {
  expect(authClient).toBeNull();
});
it('allows only public account credentials and fails incomplete/malformed configuration', () => {
  expect(authConfiguration()).toBeNull();
  expect(() => authConfiguration('https://demo.supabase.co')).toThrow();
  expect(() => authConfiguration('not a url', 'sb_publishable_test')).toThrow();
  expect(() => authConfiguration('http://example.com', 'sb_publishable_test')).toThrow();
  expect(() => authConfiguration('https://user:pass@example.com', 'sb_publishable_test')).toThrow();
  expect(() => authConfiguration('https://demo.supabase.co', 'sb_secret_private')).toThrow();
  expect(authConfiguration('https://demo.supabase.co', 'sb_publishable_test')?.url).toBe('https://demo.supabase.co');
  const jwt = `header.${btoa(JSON.stringify({ role: 'service_role' }))}.signature`;
  expect(() => authConfiguration('https://demo.supabase.co', jwt)).toThrow();
});
it('restricts web and native callbacks to their exact redirect target', () => {
  vi.spyOn(Capacitor, 'isNativePlatform').mockReturnValue(false);
  vi.stubGlobal('window', { location: { origin: 'https://questbound.test', pathname: '/' } });
  expect(authCallbackCode('https://questbound.test/?code=ok')).toBe('ok');
  expect(authCallbackCode('https://elsewhere.test/?code=bad')).toBeNull();
  expect(authCallbackCode('https://questbound.test/other?code=bad')).toBeNull();
  expect(() => authCallbackCode('https://questbound.test/?error_description=Denied')).toThrow('Denied');
  vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
  expect(authCallbackCode('com.plaivang.questbound://auth/callback?code=native')).toBe('native');
  expect(authCallbackCode('com.plaivang.questbound://other/callback?code=bad')).toBeNull();
});
it('does not exchange a single-use PKCE code twice when effects remount', async () => {
  const client = createClient('https://demo.supabase.co', 'sb_publishable_test', { auth: { autoRefreshToken: false, persistSession: false } });
  const exchange = vi.spyOn(client.auth, 'exchangeCodeForSession').mockResolvedValue({ data: { user: null, session: null }, error: new AuthError('Test response') });
  await Promise.all([exchangeAuthCode(client, 'one'), exchangeAuthCode(client, 'one')]);
  expect(exchange).toHaveBeenCalledTimes(1);
  await exchangeAuthCode(client, 'two');
  expect(exchange).toHaveBeenCalledTimes(2);
});
