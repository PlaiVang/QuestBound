import { expect, it } from 'vitest';
import { simulatedRuns } from './simulatedRuns';
import { runLaps } from '../lib/analytics';
import { manualRun } from '../game/runFactory';

it('creates repeat-safe, labeled fixtures with gap/partial-lap coverage without touching real runs', () => {
  const real = manualRun({ startedAt: 10000, distanceM: 2000, durationSec: 600, elevationGainM: 0 }, []);
  const before = JSON.stringify(real);
  const fixtures = simulatedRuns(Date.UTC(2026, 9, 5), [real]);
  expect(fixtures).toHaveLength(6);
  expect(fixtures.every(f => f.run.simulated === true)).toBe(true);
  expect(fixtures.filter(f => f.run.source === 'gps')).toHaveLength(5);
  expect(fixtures[3].points.some(p => p[4] === 1)).toBe(true);
  expect(fixtures[2].points.some(p => p[3] === null)).toBe(true);
  expect(runLaps(fixtures[5].run, [], 'mi').at(-1)?.partial).toBe(true);
  expect(simulatedRuns(Date.UTC(2026, 9, 5), [real, ...fixtures.map(f => f.run)])).toEqual([]);
  expect(JSON.stringify(real)).toBe(before);
});
