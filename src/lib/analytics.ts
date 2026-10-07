import type { Run, TrackPoint } from '../game/types';
import { cumulative } from './geo';
import { unitMeters } from './format';
import type { Units } from '../game/types';
import { addDays, startOfWeek, weekKey } from './dates';

export interface Lap { distanceM: number; seconds: number; partial: boolean }

export function runLaps(run: Run, points: TrackPoint[], units: Units): Lap[] {
  const size = unitMeters(units);
  const route = cumulative(points);
  const distance = run.source === 'manual' ? run.distanceM : route.dist.at(-1) ?? 0;
  const seconds = run.source === 'manual' ? run.durationSec : route.time.at(-1) ?? 0;
  if (distance <= 0 || seconds <= 0) return [];
  const boundaryTime = (at: number) => {
    if (run.source === 'manual') return seconds * at / distance;
    const i = route.dist.findIndex(d => d >= at);
    if (i <= 0) return 0;
    const span = route.dist[i] - route.dist[i - 1];
    return route.time[i - 1] + (span > 0 ? (at - route.dist[i - 1]) / span : 0) * (route.time[i] - route.time[i - 1]);
  };
  const laps: Lap[] = [];
  let previousTime = 0;
  for (let start = 0; start < distance; start += size) {
    const end = Math.min(distance, start + size);
    if (end - start < 0.5) break;
    const time = boundaryTime(end);
    laps.push({ distanceM: end - start, seconds: time - previousTime, partial: end - start < size - 0.5 });
    previousTime = time;
  }
  return laps;
}

export function routeSeries(points: TrackPoint[], units: Units) {
  const { dist } = cumulative(points);
  return points.map((p, i) => {
    // A 20-second window within one segment reduces single-fix pace noise.
    let from = i;
    while (from > 0 && points[from - 1][4] === p[4] && p[2] - points[from - 1][2] <= 20000) from--;
    const meters = dist[i] - dist[from];
    const seconds = (p[2] - points[from][2]) / 1000;
    const pace = meters >= 10 && seconds >= 5 ? seconds * unitMeters(units) / meters : null;
    return { distance: dist[i] / unitMeters(units), pace: pace !== null && pace <= 3600 ? pace : null,
      elevation: p[3], segment: p[4] };
  });
}

export function trainingWeeks(runs: Run[], now: number) {
  const current = startOfWeek(now);
  return Array.from({ length: 12 }, (_, i) => {
    const start = addDays(current, (i - 11) * 7);
    const logs = runs.filter(r => weekKey(r.startedAt) === weekKey(start));
    return { start, runs: logs.length, distanceM: logs.reduce((s, r) => s + r.distanceM, 0),
      seconds: logs.reduce((s, r) => s + r.durationSec, 0),
      completed: new Set(logs.filter(r => r.training?.completed).map(r => r.training!.sessionId)).size };
  });
}
