import { Capacitor } from '@capacitor/core';
import { featureFlags } from '../config/featureFlags';
import type { FixVerdict } from '../lib/geo';

const KEY = 'questbound-diagnostics:v1';
const PREF = 'questbound-diagnostics:enabled';
const LIMIT = 200;
const CODES = ['app.started', 'app.error', 'app.rejection', 'run.countdown', 'run.cancel-countdown', 'run.started',
  'run.paused', 'run.resumed', 'run.finished', 'run.discarded', 'run.restored', 'run.restore-failed',
  'gps.batch', 'gps.error', 'storage.ready', 'storage.failed', 'storage.run-saved', 'storage.run-deleted',
  'storage.write-failed', 'health.import-started', 'health.import-finished', 'health.import-failed',
  'test.seeded', 'test.removed', 'account.failed', 'account.succeeded'] as const;
type Code = typeof CODES[number];
interface Data { count?: number; accepted?: number; invalid?: number; inaccurate?: number; jitter?: number; jump?: number; stale?: number }
export interface DiagnosticEvent { at: number; elapsedMs: number; code: Code; data: Data }
const began = Date.now();
let events: DiagnosticEvent[] | null = null;
let persistenceFailed = false;
let pendingGps: Partial<Record<FixVerdict, number>> = {};
let gpsCount = 0;
function enabled() {
  if (!featureFlags.diagnostics) return false;
  try { return localStorage.getItem(PREF) !== 'false'; }
  catch { persistenceFailed = true; return true; }
}
function sanitized(data: Data): Data {
  const out: Data = {};
  for (const key of ['count', 'accepted', 'invalid', 'inaccurate', 'jitter', 'jump', 'stale'] as const) {
    const value = data[key];
    if (typeof value === 'number' && Number.isFinite(value) && value >= 0) out[key] = Math.min(1_000_000, Math.round(value));
  }
  return out;
}
function load() {
  if (events) return events;
  events = [];
  try {
    const raw = localStorage.getItem(KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) throw new Error('Invalid diagnostics');
    events = parsed.slice(-LIMIT).filter(e => e && CODES.includes(e.code) && Number.isFinite(e.at) && Number.isFinite(e.elapsedMs))
      .map(e => ({ at: e.at, elapsedMs: e.elapsedMs, code: e.code, data: sanitized(e.data ?? {}) }));
  } catch { persistenceFailed = true; }
  return events;
}
function persist() {
  try { localStorage.setItem(KEY, JSON.stringify(load())); }
  catch { persistenceFailed = true; }
}
function record(code: Code, data: Data = {}) {
  if (!enabled()) return;
  const list = load();
  list.push({ at: Date.now(), elapsedMs: Math.max(0, Date.now() - began), code, data: sanitized(data) });
  if (list.length > LIMIT) list.splice(0, list.length - LIMIT);
  persist();
}
function flushGps() {
  if (gpsCount) record('gps.batch', pendingGps);
  gpsCount = 0; pendingGps = {};
}
export const diagnostics = {
  record,
  gps(verdict: FixVerdict) {
    if (!enabled()) return;
    pendingGps[verdict] = (pendingGps[verdict] ?? 0) + 1;
    if (++gpsCount >= 30) flushGps();
  },
  flushGps,
  status: () => ({ enabled: enabled(), count: load().length, persistenceFailed }),
  setEnabled(value: boolean) {
    localStorage.setItem(PREF, String(value));
    if (!value) diagnostics.clear();
  },
  clear() {
    localStorage.removeItem(KEY);
    events = []; pendingGps = {}; gpsCount = 0; persistenceFailed = false;
  },
  export() {
    flushGps();
    return { app: 'questbound', schemaVersion: 1, appVersion: __APP_VERSION__, buildRevision: __BUILD_REVISION__,
      exportedAt: Date.now(), platform: Capacitor.getPlatform(), featureFlags, ...diagnostics.status(), events: load().map(e => ({ ...e, data: { ...e.data } })) };
  },
};
export function installDiagnostics() {
  diagnostics.record('app.started');
  window.addEventListener('error', () => diagnostics.record('app.error'));
  window.addEventListener('unhandledrejection', () => diagnostics.record('app.rejection'));
  window.addEventListener('pagehide', () => diagnostics.flushGps());
}
