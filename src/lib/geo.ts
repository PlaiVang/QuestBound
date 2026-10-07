import type { BestEfforts, TrackPoint } from '../game/types';

export const EFFORT_DISTANCES = [1000, 5000, 10000, 21097] as const;

const EARTH_RADIUS_M = 6371000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface RawFix {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  time: number;
}

export const GPS_RULES = {
  maxAccuracyM: 25,
  minMoveM: 3,
  maxSpeedMps: 9,
  maxGapMs: 30000,
};

export type FixVerdict = 'accepted' | 'invalid' | 'inaccurate' | 'jitter' | 'jump' | 'stale';

/**
 * Accumulates filtered GPS fixes into a track. Each pause starts a new segment so
 * no distance is counted across the pause gap.
 */
export class TrackAccumulator {
  points: TrackPoint[] = [];
  distanceM = 0;
  private segment = 0;
  private segmentOpen = false;

  newSegment() {
    if (this.segmentOpen) this.segment += 1;
    this.segmentOpen = false;
  }

  add(fix: RawFix): FixVerdict {
    if (!Number.isFinite(fix.latitude) || Math.abs(fix.latitude) > 90 ||
        !Number.isFinite(fix.longitude) || Math.abs(fix.longitude) > 180 ||
        !Number.isFinite(fix.accuracy) || fix.accuracy < 0 || !Number.isFinite(fix.time) ||
        (fix.altitude !== null && !Number.isFinite(fix.altitude))) return 'invalid';
    if (fix.accuracy > GPS_RULES.maxAccuracyM) return 'inaccurate';
    const last = this.points[this.points.length - 1];
    if (last && fix.time <= last[2]) return 'stale';
    // A missing signal cannot prove the path traveled; don't draw a shortcut
    // or count its straight-line distance through the gap.
    if (this.segmentOpen && last && fix.time - last[2] > GPS_RULES.maxGapMs) this.newSegment();
    if (this.segmentOpen && last) {
      if (fix.time <= last[2]) return 'stale';
      const d = haversine(last[0], last[1], fix.latitude, fix.longitude);
      if (d < GPS_RULES.minMoveM) return 'jitter';
      const speed = d / ((fix.time - last[2]) / 1000);
      if (speed > GPS_RULES.maxSpeedMps) return 'jump';
      this.distanceM += d;
    }
    this.points.push([fix.latitude, fix.longitude, fix.time, fix.altitude, this.segment]);
    this.segmentOpen = true;
    return 'accepted';
  }

  static from(points: TrackPoint[]): TrackAccumulator {
    const acc = new TrackAccumulator();
    acc.points = points.slice();
    acc.distanceM = trackDistance(points);
    const last = points[points.length - 1];
    if (last) {
      acc.segment = last[4];
      acc.segmentOpen = true;
    }
    return acc;
  }
}

export function trackDistance(points: TrackPoint[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a[4] === b[4]) total += haversine(a[0], a[1], b[0], b[1]);
  }
  return total;
}

/** Cumulative distance and moving time at each point (pause gaps excluded). */
export function cumulative(points: TrackPoint[]) {
  const dist: number[] = [];
  const time: number[] = [];
  let d = 0;
  let t = 0;
  points.forEach((p, i) => {
    if (i > 0 && points[i - 1][4] === p[4]) {
      const prev = points[i - 1];
      d += haversine(prev[0], prev[1], p[0], p[1]);
      t += (p[2] - prev[2]) / 1000;
    }
    dist.push(d);
    time.push(t);
  });
  return { dist, time };
}

/** Seconds per full split, interpolated at each distance boundary. */
export function computeSplits(points: TrackPoint[], splitMeters = 1000): number[] {
  if (!Number.isFinite(splitMeters) || splitMeters <= 0) throw new RangeError('Split distance must be positive and finite.');
  const { dist, time } = cumulative(points);
  const splits: number[] = [];
  let nextKm = splitMeters;
  let lastBoundaryTime = 0;
  for (let i = 1; i < dist.length; i++) {
    while (dist[i] >= nextKm) {
      const span = dist[i] - dist[i - 1];
      const frac = span > 0 ? (nextKm - dist[i - 1]) / span : 1;
      const at = time[i - 1] + frac * (time[i] - time[i - 1]);
      splits.push(Math.round(at - lastBoundaryTime));
      lastBoundaryTime = at;
      nextKm += splitMeters;
    }
  }
  return splits;
}

/** Fastest moving time to cover `meters` anywhere in the track, using a sliding window. */
export function bestEffort(points: TrackPoint[], meters: number): number | undefined {
  const { dist, time } = cumulative(points);
  if (!dist.length || dist[dist.length - 1] < meters) return undefined;
  let best = Infinity;
  let i = 0;
  for (let j = 1; j < dist.length; j++) {
    if (points[j][4] !== points[j - 1][4]) {
      i = j;
      continue;
    }
    while (i < j && dist[j] - dist[i + 1] >= meters) i++;
    const covered = dist[j] - dist[i];
    if (covered >= meters && covered > 0) {
      const scaled = ((time[j] - time[i]) * meters) / covered;
      if (scaled < best) best = scaled;
    }
  }
  return Number.isFinite(best) ? Math.round(best) : undefined;
}

export function computeBestEfforts(points: TrackPoint[]): BestEfforts {
  const efforts: BestEfforts = {};
  for (const m of EFFORT_DISTANCES) {
    const t = bestEffort(points, m);
    if (t !== undefined) efforts[m] = t;
  }
  return efforts;
}

/** Estimated best efforts for a run without GPS points, assuming even pacing. */
export function evenPaceEfforts(distanceM: number, durationSec: number): BestEfforts {
  const efforts: BestEfforts = {};
  for (const m of EFFORT_DISTANCES) {
    if (distanceM >= m && distanceM > 0) efforts[m] = Math.round((durationSec * m) / distanceM);
  }
  return efforts;
}

export function evenPaceSplits(distanceM: number, durationSec: number, splitMeters = 1000): number[] {
  if (!Number.isFinite(splitMeters) || splitMeters <= 0) throw new RangeError('Split distance must be positive and finite.');
  const perSplit = distanceM > 0 ? (durationSec * splitMeters) / distanceM : 0;
  return Array.from({ length: Math.floor(distanceM / splitMeters) }, () => Math.round(perSplit));
}

/** Positive elevation change with a hysteresis threshold to ignore GPS altitude noise. */
export function elevationGain(points: TrackPoint[], thresholdM = 4): number {
  let gain = 0;
  let anchor: number | null = null;
  for (const p of points) {
    const alt = p[3];
    if (alt === null || alt === undefined) continue;
    if (anchor === null) {
      anchor = alt;
      continue;
    }
    if (alt - anchor >= thresholdM) {
      gain += alt - anchor;
      anchor = alt;
    } else if (anchor - alt >= thresholdM) {
      anchor = alt;
    }
  }
  return Math.round(gain);
}

/** Coefficient of variation of speed over ~200 m chunks. Null when too short to judge. */
export function paceVariability(points: TrackPoint[], chunkM = 200): number | null {
  const { dist, time } = cumulative(points);
  const speeds: number[] = [];
  let startIdx = 0;
  for (let i = 1; i < dist.length; i++) {
    if (dist[i] - dist[startIdx] >= chunkM) {
      const dt = time[i] - time[startIdx];
      if (dt > 0) speeds.push((dist[i] - dist[startIdx]) / dt);
      startIdx = i;
    }
  }
  if (speeds.length < 5) return null;
  const mean = speeds.reduce((a, b) => a + b, 0) / speeds.length;
  const variance = speeds.reduce((a, s) => a + (s - mean) ** 2, 0) / speeds.length;
  return mean > 0 ? Math.sqrt(variance) / mean : null;
}
