import { useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Browser } from '@capacitor/browser';
import { authClient, authRedirect, authConfigurationError } from '../auth/client';
import { useAuth } from '../auth/useAuth';
import { diagnostics } from '../diagnostics/recorder';

export function AccountSettings() {
  const { session, ready, error: sessionError, recovery } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const action = async (task: () => Promise<string>) => {
    setBusy(true); setError(''); setMessage('');
    try { setMessage(await task()); diagnostics.record('account.succeeded'); }
    catch (e) { diagnostics.record('account.failed'); setError(e instanceof Error ? e.message : 'Account action failed. Try again.'); }
    finally { setBusy(false); setPassword(''); }
  };
  if (!authClient) return <section className="panel">
    <h2>Account</h2>
    <p className="small">You’re using QuestBound locally without an account.</p>
    <p className="small muted">Online accounts are not configured in this build. Google, Apple, and email sign-in require a hosted Supabase project and provider setup. Your runs remain on this device; use Export below to keep a backup.</p>
    {authConfigurationError && <p className="small" role="alert">Account configuration error: {authConfigurationError}</p>}
  </section>;
  const client = authClient;
  const social = (provider: 'google' | 'apple') => action(async () => {
    const { data, error } = await client.auth.signInWithOAuth({ provider, options: {
      redirectTo: authRedirect(), skipBrowserRedirect: true,
    } });
    if (error) throw error;
    if (!data.url) throw new Error('The sign-in provider did not return a login URL.');
    if (Capacitor.isNativePlatform()) await Browser.open({ url: data.url });
    else window.location.assign(data.url);
    return 'Complete sign-in in the browser.';
  });
  return <section className="panel">
    <h2>Account</h2>
    {!ready ? <p role="status">Loading account…</p> : session ? <>
      <p className="small" style={{ overflowWrap: 'anywhere' }}>Signed in as <b>{session.user.email ?? 'Connected account'}</b></p>
      <p className="small muted">This account does not sync or own your local run log yet. Settings and runs belong to this device and remain visible after logout or switching accounts. Export below before changing devices.</p>
      <button className="btn" disabled={busy} onClick={() => void action(async () => {
        const { error } = await client.auth.signOut({ scope: 'local' });
        if (error) throw error;
        return 'Signed out on this device. Local runs were kept.';
      })}>Log out</button>
      <form onSubmit={e => { e.preventDefault(); void action(async () => {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
        return 'Password updated.';
      }); }}>
        <label className="field">{recovery ? 'Choose a new password' : 'Change password'}
          <input type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} />
        </label>
        <button className="btn" type="submit" disabled={busy}>Update password</button>
      </form>
    </> : <>
      <div className="row wrap">
        <button className="btn" disabled={busy} onClick={() => void social('google')}>Continue with Google</button>
        <button className="btn" disabled={busy} onClick={() => void social('apple')}>Continue with Apple</button>
      </div>
      <div className="segmented">
        <button aria-pressed={mode === 'signin'} className={mode === 'signin' ? 'on' : ''} onClick={() => setMode('signin')}>Sign in</button>
        <button aria-pressed={mode === 'signup'} className={mode === 'signup' ? 'on' : ''} onClick={() => setMode('signup')}>Sign up</button>
      </div>
      <form onSubmit={e => { e.preventDefault(); void action(async () => {
        const { data, error } = mode === 'signup'
          ? await client.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: authRedirect() } })
          : await client.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
        return data.session ? 'Signed in. Your run log remains device-local.' : 'Check your email to confirm your account.';
      }); }}>
        <label className="field">Email<input type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></label>
        <label className="field">Password<input type="password" autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={e => setPassword(e.target.value)} /></label>
        <button className="btn primary" disabled={busy || !ready} type="submit">{busy ? 'Working…' : mode === 'signup' ? 'Create account' : 'Sign in'}</button>
      </form>
      <button className="btn ghost" disabled={busy || !email.trim()} onClick={() => void action(async () => {
        const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: authRedirect() });
        if (error) throw error;
        return 'If an account exists, a password reset email will be sent. Open it on this device.';
      })}>Forgot password</button>
      <p className="tiny muted">An account is optional. Run data stays on this device; signing in is not cloud backup. Open email confirmation and reset links on this device.</p>
    </>}
    {(error || sessionError) && <p className="small" role="alert">{error || sessionError}</p>}
    {message && <p className="small" role="status">{message}</p>}
  </section>;
}
