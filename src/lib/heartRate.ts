import type { Run } from '../game/types';

export function validateHeartRate(value: unknown): asserts value is NonNullable<Run['heartRate']> {
  if (!value || typeof value !== 'object' || !('averageBpm' in value) || !('maxBpm' in value) || !('source' in value) ||
    !['manual', 'health-connect'].includes(String(value.source)) || typeof value.averageBpm !== 'number' || typeof value.maxBpm !== 'number' ||
    !Number.isInteger(value.averageBpm) || !Number.isInteger(value.maxBpm) ||
    value.averageBpm < 30 || value.maxBpm > 250 || value.maxBpm < value.averageBpm) {
    throw new Error('Enter whole-number heart rates from 30 to 250 bpm, with maximum at least average.');
  }
}
