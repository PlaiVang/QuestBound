import { expect, it } from 'vitest';
import { validateHeartRate } from './heartRate';

it('requires real, plausible whole-number average and maximum values', () => {
  expect(() => validateHeartRate({ averageBpm: 140, maxBpm: 180, source: 'manual' })).not.toThrow();
  for (const value of [
    { averageBpm: 180, maxBpm: 140, source: 'manual' },
    { averageBpm: 0, maxBpm: 180, source: 'manual' },
    { averageBpm: 140.5, maxBpm: 180, source: 'manual' },
    { averageBpm: 140, maxBpm: 300, source: 'manual' },
    { averageBpm: 140, maxBpm: 180, source: 'gps' },
  ]) expect(() => validateHeartRate(value)).toThrow();
});
