import { manualRun } from '../game/runFactory';
import type { Run } from '../game/types';
import { validateHeartRate } from '../lib/heartRate';

export interface HealthRun { id: string; startedAt: number; durationSec: number; distanceM: number; averageBpm?: number; maxBpm?: number }
export function prepareHealthRun(record: HealthRun, prior: Run[]): Run | null {
  if (!record || typeof record.id !== 'string' || !record.id || !Number.isFinite(record.startedAt) ||
    !Number.isFinite(record.durationSec) || record.durationSec <= 0 || !Number.isFinite(record.distanceM) || record.distanceM < 0) {
    throw new Error('Health Connect returned an invalid running session.');
  }
  const id = `health-connect:${record.id}`;
  if (prior.some(r => r.id === id || Math.abs(r.startedAt - record.startedAt) < 60000)) return null;
  const run = manualRun({ startedAt: record.startedAt, durationSec: record.durationSec, distanceM: record.distanceM,
    elevationGainM: 0, notes: 'Imported from Samsung Health via Health Connect. Duration is elapsed session time; route and elevation are not imported. Laps are estimated. Missing distance is recorded as zero.' }, prior);
  run.id = id;
  run.importedFrom = 'samsung-health';
  if (record.averageBpm !== undefined || record.maxBpm !== undefined) {
    const heartRate = { averageBpm: record.averageBpm, maxBpm: record.maxBpm, source: 'health-connect' };
    validateHeartRate(heartRate);
    run.heartRate = heartRate;
  }
  return run;
}
