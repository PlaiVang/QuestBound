import { Capacitor } from '@capacitor/core';
import type { Profile, Redemption, Reward, Run, TrackPoint } from '../game/types';
import { validatePlan, type TrainingPlan } from '../training/plans';
import { validateHeartRate } from '../lib/heartRate';
import { diagnostics } from '../diagnostics/recorder';

export interface Backup {
  app: 'questbound';
  version: 1;
  exportedAt: number;
  profile: Profile;
  runs: Run[];
  points: Record<string, TrackPoint[]>;
  rewards: Reward[];
  redemptions: Redemption[];
  trainingPlan?: TrainingPlan | null;
}

export const DEFAULT_PROFILE: Profile = { heroName: 'Hero', units: 'km' };

export const DEFAULT_REWARDS: Reward[] = [
  { id: 'treat', name: 'Favorite treat', icon: '🍩', cost: 60 },
  { id: 'movie', name: 'Movie night', icon: '🎬', cost: 150 },
  { id: 'gear', name: 'New running gear', icon: '👟', cost: 800 },
];

/** Low-level storage: runs and their GPS points, plus a small key-value store. */
interface Driver {
  init(): Promise<void>;
  allRuns(): Promise<Run[]>;
  putRun(run: Run): Promise<void>;
  deleteRun(id: string): Promise<void>;
  getPoints(id: string): Promise<TrackPoint[]>;
  putPoints(id: string, points: TrackPoint[]): Promise<void>;
  getKv(key: string): Promise<string | null>;
  setKv(key: string, value: string): Promise<void>;
  clear(): Promise<void>;
}

class LocalStorageDriver implements Driver {
  private prefix = 'questbound:';
  async init() {}
  private read<T>(key: string, fallback: T): T {
    const raw = localStorage.getItem(this.prefix + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  }
  private write(key: string, value: unknown) {
    localStorage.setItem(this.prefix + key, JSON.stringify(value));
  }
  async allRuns() {
    return this.read<Run[]>('runs', []);
  }
  async putRun(run: Run) {
    const runs = (await this.allRuns()).filter((r) => r.id !== run.id);
    this.write('runs', [...runs, run]);
  }
  async deleteRun(id: string) {
    this.write('runs', (await this.allRuns()).filter((r) => r.id !== id));
    localStorage.removeItem(`${this.prefix}points:${id}`);
  }
  async getPoints(id: string) {
    return this.read<TrackPoint[]>(`points:${id}`, []);
  }
  async putPoints(id: string, points: TrackPoint[]) {
    this.write(`points:${id}`, points);
  }
  async getKv(key: string) {
    return localStorage.getItem(`${this.prefix}kv:${key}`);
  }
  async setKv(key: string, value: string) {
    localStorage.setItem(`${this.prefix}kv:${key}`, value);
  }
  async clear() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith(this.prefix))
      .forEach((k) => localStorage.removeItem(k));
  }
}

class SqliteDriver implements Driver {
  private db!: import('@capacitor-community/sqlite').SQLiteDBConnection;

  async init() {
    const { CapacitorSQLite, SQLiteConnection } = await import('@capacitor-community/sqlite');
    const sqlite = new SQLiteConnection(CapacitorSQLite);
    await sqlite.checkConnectionsConsistency();
    const exists = (await sqlite.isConnection('questbound', false)).result;
    this.db = exists
      ? await sqlite.retrieveConnection('questbound', false)
      : await sqlite.createConnection('questbound', false, 'no-encryption', 1, false);
    await this.db.open();
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS runs (id TEXT PRIMARY KEY NOT NULL, started_at INTEGER NOT NULL, data TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS run_points (run_id TEXT PRIMARY KEY NOT NULL, points TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
    `);
  }
  async allRuns() {
    const res = await this.db.query('SELECT data FROM runs ORDER BY started_at');
    return (res.values ?? []).map((row) => JSON.parse(row.data) as Run);
  }
  async putRun(run: Run) {
    await this.db.run('INSERT OR REPLACE INTO runs (id, started_at, data) VALUES (?, ?, ?)', [
      run.id,
      run.startedAt,
      JSON.stringify(run),
    ]);
  }
  async deleteRun(id: string) {
    await this.db.run('DELETE FROM runs WHERE id = ?', [id]);
    await this.db.run('DELETE FROM run_points WHERE run_id = ?', [id]);
  }
  async getPoints(id: string) {
    const res = await this.db.query('SELECT points FROM run_points WHERE run_id = ?', [id]);
    const row = res.values?.[0];
    return row ? (JSON.parse(row.points) as TrackPoint[]) : [];
  }
  async putPoints(id: string, points: TrackPoint[]) {
    await this.db.run('INSERT OR REPLACE INTO run_points (run_id, points) VALUES (?, ?)', [id, JSON.stringify(points)]);
  }
  async getKv(key: string) {
    const res = await this.db.query('SELECT value FROM kv WHERE key = ?', [key]);
    return res.values?.[0]?.value ?? null;
  }
  async setKv(key: string, value: string) {
    await this.db.run('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', [key, value]);
  }
  async clear() {
    await this.db.execute('DELETE FROM runs; DELETE FROM run_points; DELETE FROM kv;');
  }
}

const driver: Driver = Capacitor.isNativePlatform() ? new SqliteDriver() : new LocalStorageDriver();

async function getJson<T>(key: string, fallback: T): Promise<T> {
  const raw = await driver.getKv(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

export const db = {
  async init() {
    try { await driver.init(); diagnostics.record('storage.ready'); }
    catch (e) { diagnostics.record('storage.failed'); throw e; }
  },
  runs: () => driver.allRuns(),
  saveRun: async (run: Run, points?: TrackPoint[]) => {
    try {
      if (run.heartRate !== undefined) validateHeartRate(run.heartRate);
      await driver.putRun(run);
      if (points?.length) await driver.putPoints(run.id, points);
      diagnostics.record('storage.run-saved', { count: points?.length ?? 0 });
    } catch (e) { diagnostics.record('storage.write-failed'); throw e; }
  },
  async deleteRun(id: string) {
    try { await driver.deleteRun(id); diagnostics.record('storage.run-deleted'); }
    catch (e) { diagnostics.record('storage.write-failed'); throw e; }
  },
  points: (id: string) => driver.getPoints(id),
  profile: () => getJson<Profile>('profile', DEFAULT_PROFILE),
  saveProfile: (p: Profile) => driver.setKv('profile', JSON.stringify(p)),
  rewards: () => getJson<Reward[]>('rewards', DEFAULT_REWARDS),
  saveRewards: (r: Reward[]) => driver.setKv('rewards', JSON.stringify(r)),
  redemptions: () => getJson<Redemption[]>('redemptions', []),
  saveRedemptions: (r: Redemption[]) => driver.setKv('redemptions', JSON.stringify(r)),
  async trainingPlan(): Promise<TrainingPlan | null> {
    const plan = await getJson<TrainingPlan | null>('training-plan', null);
    if (plan !== null) validatePlan(plan);
    return plan;
  },
  async saveTrainingPlan(plan: TrainingPlan) {
    validatePlan(plan);
    await driver.setKv('training-plan', JSON.stringify(plan));
  },

  async exportBackup(): Promise<Backup> {
    const runs = await driver.allRuns();
    const points: Record<string, TrackPoint[]> = {};
    for (const r of runs) {
      const p = await driver.getPoints(r.id);
      if (p.length) points[r.id] = p;
    }
    return {
      app: 'questbound',
      version: 1,
      exportedAt: Date.now(),
      profile: await db.profile(),
      runs,
      points,
      rewards: await db.rewards(),
      redemptions: await db.redemptions(),
      trainingPlan: await db.trainingPlan(),
    };
  },

  /** Replaces all data with the backup's contents. */
  async importBackup(data: unknown) {
    const b = data as Backup;
    if (!b || b.app !== 'questbound' || b.version !== 1 || !Array.isArray(b.runs)) {
      throw new Error('This file is not a QuestBound backup.');
    }
    // Validate the optional extension before replacing any existing data.
    for (const run of b.runs) if (run?.heartRate !== undefined) validateHeartRate(run.heartRate);
    if (b.trainingPlan != null) validatePlan(b.trainingPlan);
    const classes = ['ranger', 'rogue', 'paladin', 'berserker'];
    if (b.runs.some(r => !r || typeof r.id !== 'string' || !r.id || !Number.isFinite(r.startedAt) ||
      !Number.isFinite(r.durationSec) || r.durationSec < 0 || !Number.isFinite(r.distanceM) || r.distanceM < 0 ||
      !Number.isFinite(r.elevationGainM) || !classes.includes(r.autoClass) ||
      (r.classOverride !== undefined && !classes.includes(r.classOverride)) ||
      !['gps', 'manual'].includes(r.source) || !Array.isArray(r.splits) ||
      (r.importedFrom !== undefined && r.importedFrom !== 'samsung-health') ||
      (r.simulated !== undefined && typeof r.simulated !== 'boolean') ||
      r.splits.some(s => !Number.isFinite(s) || s < 0) || !r.bestEfforts ||
      Object.values(r.bestEfforts).some(s => typeof s !== 'number' || !Number.isFinite(s) || s < 0) ||
      (r.training !== undefined && (!r.training || typeof r.training.sessionId !== 'string' || typeof r.training.completed !== 'boolean')))) {
      throw new Error('The backup contains invalid run data.');
    }
    if (new Set(b.runs.map(r => r.id)).size !== b.runs.length) throw new Error('The backup contains duplicate run IDs.');
    if (b.profile && (typeof b.profile.heroName !== 'string' || !['km', 'mi'].includes(b.profile.units))) {
      throw new Error('The backup contains an invalid profile.');
    }
    if (b.rewards && (!Array.isArray(b.rewards) || b.rewards.some(r => !r || typeof r.id !== 'string' ||
      typeof r.name !== 'string' || typeof r.icon !== 'string' || !Number.isFinite(r.cost) || r.cost < 1))) {
      throw new Error('The backup contains invalid rewards.');
    }
    if (b.redemptions && (!Array.isArray(b.redemptions) || b.redemptions.some(r => !r || typeof r.id !== 'string' ||
      typeof r.rewardId !== 'string' || typeof r.name !== 'string' || typeof r.icon !== 'string' ||
      !Number.isFinite(r.cost) || r.cost < 0 || !Number.isFinite(r.at)))) {
      throw new Error('The backup contains invalid purchases.');
    }
    if (b.points && (typeof b.points !== 'object' || Object.values(b.points).some(points =>
      !Array.isArray(points) || points.some(p => !Array.isArray(p) || p.length !== 5 ||
        !Number.isFinite(p[0]) || Math.abs(p[0]) > 90 || !Number.isFinite(p[1]) || Math.abs(p[1]) > 180 ||
        !Number.isFinite(p[2]) || (p[3] !== null && !Number.isFinite(p[3])) || !Number.isInteger(p[4]))))) {
      throw new Error('The backup contains invalid route points.');
    }
    await driver.clear();
    for (const r of b.runs) await db.saveRun(r, b.points?.[r.id]);
    await db.saveProfile({ ...DEFAULT_PROFILE, ...b.profile });
    await db.saveRewards(b.rewards ?? DEFAULT_REWARDS);
    await db.saveRedemptions(b.redemptions ?? []);
    if (b.trainingPlan) await db.saveTrainingPlan(b.trainingPlan);
  },
};
