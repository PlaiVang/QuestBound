import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from './db';
import { createPlan } from '../training/plans';
import { manualRun } from '../game/runFactory';

vi.mock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => false } }));
const values = new Map<string, string>();
const storage = {
  getItem: (key: string) => values.get(key) ?? null,
  setItem(key: string, value: string) {
    values.set(key, value);
    Object.defineProperty(storage, key, { value, enumerable: true, configurable: true });
  },
  removeItem(key: string) {
    values.delete(key);
    Reflect.deleteProperty(storage, key);
  },
};

beforeEach(() => {
  for (const key of values.keys()) storage.removeItem(key);
  vi.stubGlobal('localStorage', storage);
});

describe('training backup persistence', () => {
  it('round-trips heart rate and rejects invalid imports before clearing runs', async () => {
    const run = manualRun({ startedAt: Date.now(), distanceM: 5000, durationSec: 1800, elevationGainM: 0 }, []);
    run.heartRate = { averageBpm: 140, maxBpm: 180, source: 'manual' };
    await db.saveRun(run);
    const backup = await db.exportBackup();
    await db.importBackup(backup);
    expect((await db.runs())[0].heartRate).toEqual(run.heartRate);
    backup.runs[0].heartRate!.maxBpm = 100;
    await expect(db.importBackup(backup)).rejects.toThrow();
    expect((await db.runs())[0].heartRate!.maxBpm).toBe(180);
  });
  it('round-trips a plan through storage and JSON backups', async () => {
    const plan = createPlan({ id: 'one', goal: 'routine', startDate: '2026-10-05', days: [1, 3, 6], easyMinutes: 20 });
    await db.saveTrainingPlan(plan);
    const backup = JSON.parse(JSON.stringify(await db.exportBackup()));
    await db.importBackup(backup);
    expect(await db.trainingPlan()).toEqual(plan);
  });
  it('still accepts old backups with no plan', async () => {
    const backup = await db.exportBackup();
    delete backup.trainingPlan;
    await db.importBackup(backup);
    expect(await db.trainingPlan()).toBeNull();
  });
  it('rejects an invalid plan without clearing saved data', async () => {
    const plan = createPlan({ id: 'keep', goal: 'routine', startDate: '2026-10-05', days: [1, 3, 6], easyMinutes: 20 });
    await db.saveTrainingPlan(plan);
    const backup = await db.exportBackup();
    backup.trainingPlan!.sessions[0].phases[0].seconds = -1;
    await expect(db.importBackup(backup)).rejects.toThrow();
    expect(await db.trainingPlan()).toEqual(plan);
  });
});
