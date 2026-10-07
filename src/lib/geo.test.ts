import { describe, expect, it } from 'vitest';
import {
  TrackAccumulator,
  bestEffort,
  computeSplits,
  elevationGain,
  haversine,
  paceVariability,
  trackDistance,
} from './geo';
import type { TrackPoint } from '../game/types';

/** Straight north-bound track: one point every `stepM` meters at a constant pace. */
function straightTrack(totalM: number, secPerKm: number, stepM = 10, start = 0): TrackPoint[] {
  const degPerM = 1 / 111195;
  const pts: TrackPoint[] = [];
  for (let d = 0; d <= totalM; d += stepM) {
    pts.push([d * degPerM, 0, start + (d / 1000) * secPerKm * 1000, null, 0]);
  }
  return pts;
}

describe('geo', () => {
  it('rejects malformed fixes and stale fixes after a pause', () => {
    const acc = new TrackAccumulator();
    expect(acc.add({ latitude: NaN, longitude: 0, accuracy: 5, altitude: null, time: 0 })).toBe('invalid');
    acc.add({ latitude: 0, longitude: 0, accuracy: 5, altitude: null, time: 1000 });
    acc.newSegment();
    expect(acc.add({ latitude: 0, longitude: 0, accuracy: 5, altitude: null, time: 500 })).toBe('stale');
  });
  it('does not invent distance or moving time across a GPS outage', () => {
    const acc = new TrackAccumulator();
    acc.add({ latitude: 0, longitude: 0, accuracy: 5, altitude: null, time: 0 });
    acc.add({ latitude: 0.001, longitude: 0, accuracy: 5, altitude: null, time: 60000 });
    expect(acc.distanceM).toBe(0);
    expect(acc.points[1][4]).toBe(1);
    acc.add({ latitude: 0.0011, longitude: 0, accuracy: 5, altitude: null, time: 65000 });
    expect(acc.distanceM).toBeCloseTo(11.1, 0);
  });
  it('computes haversine distance', () => {
    expect(haversine(0, 0, 0, 1)).toBeCloseTo(111195, -2);
  });

  it('computes track distance and splits', () => {
    const pts = straightTrack(3010, 300);
    expect(trackDistance(pts)).toBeCloseTo(3010, -1);
    const splits = computeSplits(pts);
    expect(splits).toHaveLength(3);
    splits.forEach((s) => expect(s).toBeCloseTo(300, -1));
  });

  it('finds the fastest segment', () => {
    const slow = straightTrack(2000, 400);
    const lastT = slow[slow.length - 1][2];
    const fast = straightTrack(1000, 240).map(
      (p): TrackPoint => [p[0] + slow[slow.length - 1][0], 0, p[2] + lastT, null, 0],
    );
    const t = bestEffort([...slow, ...fast.slice(1)], 1000);
    expect(t).toBeGreaterThan(235);
    expect(t).toBeLessThan(245);
    expect(bestEffort(slow, 5000)).toBeUndefined();
  });

  it('does not count distance across pause segments', () => {
    const a = straightTrack(1000, 300);
    const b = straightTrack(1000, 300, 10, 10_000_000).map((p): TrackPoint => [p[0] + 0.05, 0, p[2], null, 1]);
    expect(trackDistance([...a, ...b])).toBeCloseTo(2000, -1);
    expect(bestEffort([...a, ...b], 1500)).toBeUndefined();
  });

  it('filters inaccurate, jittery and impossible fixes', () => {
    const acc = new TrackAccumulator();
    expect(acc.add({ latitude: 0, longitude: 0, accuracy: 5, altitude: null, time: 0 })).toBe('accepted');
    expect(acc.add({ latitude: 0.001, longitude: 0, accuracy: 80, altitude: null, time: 5000 })).toBe('inaccurate');
    expect(acc.add({ latitude: 0.00001, longitude: 0, accuracy: 5, altitude: null, time: 6000 })).toBe('jitter');
    expect(acc.add({ latitude: 0.01, longitude: 0, accuracy: 5, altitude: null, time: 7000 })).toBe('jump');
    expect(acc.add({ latitude: 0.0001, longitude: 0, accuracy: 5, altitude: null, time: 10000 })).toBe('accepted');
    expect(acc.distanceM).toBeCloseTo(11.1, 0);
  });

  it('ignores small altitude noise when computing elevation gain', () => {
    const pts: TrackPoint[] = [10, 12, 9, 11, 10, 20, 30, 28, 40].map((alt, i) => [0, 0, i, alt, 0]);
    expect(elevationGain(pts)).toBe(30);
  });

  it('detects interval-like pacing', () => {
    const steady = straightTrack(3000, 300);
    expect(paceVariability(steady)).toBeLessThan(0.05);
    const pts: TrackPoint[] = [];
    let t = 0;
    for (let d = 0; d <= 3000; d += 10) {
      pts.push([d / 111195, 0, t, null, 0]);
      t += Math.floor(d / 400) % 2 ? 4000 : 2000;
    }
    expect(paceVariability(pts)!).toBeGreaterThan(0.15);
  });
});
