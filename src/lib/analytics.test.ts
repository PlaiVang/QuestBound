import { describe, expect, it } from 'vitest';
import { manualRun } from '../game/runFactory';
import type { TrackPoint } from '../game/types';
import { routeSeries, runLaps, trainingWeeks } from './analytics';

const run = manualRun({ startedAt: new Date(2026, 9, 6).getTime(), distanceM: 1609.344 * 2.4, durationSec: 1440, elevationGainM: 0 }, []);
describe('run analysis', () => {
  it('includes final partial mile with proportional manual time and pace', () => {
    const laps = runLaps(run, [], 'mi');
    expect(laps).toHaveLength(3);
    expect(laps.map(l => Math.round(l.seconds))).toEqual([600, 600, 240]);
    expect(laps[2].partial).toBe(true);
    expect(laps[2].distanceM).toBeCloseTo(1609.344 * 0.4);
    expect(runLaps({ ...run, distanceM: 0 }, [], 'km')).toEqual([]);
  });
  it('calculates GPS laps from tracked time, excluding pause gaps', () => {
    const points: TrackPoint[] = [[0, 0, 0, null, 0], [0.009, 0, 300000, null, 0],
      [1, 0, 900000, null, 1], [1.009, 0, 1200000, null, 1]];
    const laps = runLaps({ ...run, source: 'gps' }, points, 'km');
    expect(laps).toHaveLength(3);
    expect(laps.reduce((s, l) => s + l.seconds, 0)).toBeCloseTo(600);
    expect(laps[2].partial).toBe(true);
  });
  it('does not smooth pace across segments or fabricate missing elevation', () => {
    const points: TrackPoint[] = [[0, 0, 0, null, 0], [0.001, 0, 10000, 12, 0], [1, 0, 20000, null, 1]];
    const series = routeSeries(points, 'mi');
    expect(series[0].pace).toBeNull();
    expect(series[1].pace).not.toBeNull();
    expect(series[2].pace).toBeNull();
    expect(series[2].elevation).toBeNull();
  });
  it('counts completed sessions once across multiple logs', () => {
    const linked = { ...run, training: { sessionId: 'plan:1', completed: true } };
    const weeks = trainingWeeks([linked, { ...linked, id: 'another' }], run.startedAt);
    expect(weeks).toHaveLength(12);
    expect(weeks.at(-1)?.completed).toBe(1);
    expect(weeks.at(-1)?.runs).toBe(2);
  });
});
