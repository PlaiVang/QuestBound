export function authConfiguration(url?: string, key?: string): { url: string; key: string } | null {
  if (!url && !key) return null;
  if (!url || !key) throw new Error('Account setup requires both a Supabase URL and public publishable key.');
  const parsed = new URL(url);
  if (parsed.protocol !== 'https:' && !(parsed.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(parsed.hostname))) {
    throw new Error('Use an HTTPS Supabase URL (HTTP is allowed only for local development).');
  }
  if (parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
    throw new Error('Use your Supabase project root URL without credentials, path, or query parameters.');
  }
  if (!key.startsWith('sb_publishable_')) {
    let role: unknown;
    try { role = JSON.parse(atob(key.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).role; }
    catch { throw new Error('Use a Supabase publishable or legacy anon key, never a secret/service-role key.'); }
    if (role !== 'anon') throw new Error('Use a public anon key, never a secret/service-role key.');
  }
  return { url: parsed.origin, key };
}
