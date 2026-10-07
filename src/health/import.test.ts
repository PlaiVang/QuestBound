import { expect, it } from 'vitest';
import { prepareHealthRun } from './import';
const record = { id: 'one', startedAt: 100000, durationSec: 1800, distanceM: 5000, averageBpm: 140, maxBpm: 180 };
it('imports real heart rate and preserves provenance with stable duplicate protection', () => {
  const run = prepareHealthRun(record, []);
  expect(run?.importedFrom).toBe('samsung-health');
  expect(run?.heartRate?.source).toBe('health-connect');
  expect(prepareHealthRun(record, [run!])).toBeNull();
  expect(prepareHealthRun({ ...record, id: 'two', startedAt: 110000 }, [run!])).toBeNull();
});
it('rejects invalid data and leaves missing measurements absent', () => {
  expect(() => prepareHealthRun({ ...record, maxBpm: 100 }, [])).toThrow();
  expect(() => prepareHealthRun({ ...record, distanceM: -1 }, [])).toThrow();
  expect(prepareHealthRun({ ...record, averageBpm: undefined, maxBpm: undefined }, [])?.heartRate).toBeUndefined();
});
