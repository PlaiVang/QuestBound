import type { Units } from '../game/types';

const MI = 1609.344;

export const unitMeters = (units: Units) => (units === 'mi' ? MI : 1000);

export function formatDistance(meters: number, units: Units, digits = 2): string {
  return `${(meters / unitMeters(units)).toFixed(digits)} ${units}`;
}

export function formatDuration(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h ? String(m).padStart(2, '0') : String(m);
  return `${h ? `${h}:` : ''}${mm}:${String(sec).padStart(2, '0')}`;
}

/** Pace as m:ss per unit, or "--" when it cannot be computed. */
export function formatPace(meters: number, seconds: number, units: Units): string {
  if (meters < 10 || seconds <= 0) return '--';
  const perUnit = (seconds * unitMeters(units)) / meters;
  if (perUnit > 60 * 60) return '--';
  return `${formatDuration(perUnit)} /${units}`;
}

export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export function formatDateTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export const uid = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
