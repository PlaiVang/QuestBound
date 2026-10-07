import { useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { authCallbackCode, authClient, exchangeAuthCode } from './client';
import { AuthContext } from './useAuth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(!authClient);
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState(false);
  useEffect(() => {
    if (!authClient) return;
    const client = authClient;
    let cancelled = false;
    let authRevision = 0;
    let lastCode: string | null = null;
    const callback = async (url: string) => {
      try {
        const code = authCallbackCode(url);
        if (!code || code === lastCode) return;
        lastCode = code;
        const { error } = await exchangeAuthCode(client, code);
        if (error) throw error;
        if (!cancelled) {
          setError('');
          if (!Capacitor.isNativePlatform()) window.history.replaceState(null, '', `${window.location.pathname}#/settings`);
          else window.location.hash = '#/settings';
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Sign-in callback failed.');
          window.location.hash = '#/settings';
        }
      }
    };
    const { data: { subscription } } = client.auth.onAuthStateChange((event, session) => {
      authRevision++;
      if (!cancelled) {
        setSession(session);
        setReady(true);
        if (event === 'PASSWORD_RECOVERY') setRecovery(true);
        if (event === 'SIGNED_OUT' || event === 'USER_UPDATED') setRecovery(false);
      }
    });
    void client.auth.getSession().then(({ data, error }) => {
      if (!cancelled && authRevision === 0) { setSession(data.session); setReady(true); if (error) setError(error.message); }
    }).catch(e => { if (!cancelled) { setReady(true); setError(e instanceof Error ? e.message : 'Unable to read account session.'); } });
    void callback(window.location.href);
    const listener = Capacitor.isNativePlatform() ? App.addListener('appUrlOpen', event => { void callback(event.url); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to listen for sign-in links.'); return null; }) : null;
    if (Capacitor.isNativePlatform()) void App.getLaunchUrl().then(result => { if (result) void callback(result.url); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Unable to read sign-in link.'); });
    return () => { cancelled = true; subscription.unsubscribe(); if (listener) void listener.then(handle => handle?.remove()); };
  }, []);
  return <AuthContext.Provider value={{ session, ready, error, recovery }}>{children}</AuthContext.Provider>;
}
