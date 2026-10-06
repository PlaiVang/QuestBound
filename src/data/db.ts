import { Capacitor } from '@capacitor/core';
import type { Profile, Redemption, Reward, Run, TrackPoint } from '../game/types';

export interface Backup {
  app: 'questbound';
  version: 1;
  exportedAt: number;
  profile: Profile;
  runs: Run[];
  points: Record<string, TrackPoint[]>;
  rewards: Reward[];
  redemptions: Redemption[];
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
  init: () => driver.init(),
  runs: () => driver.allRuns(),
  saveRun: async (run: Run, points?: TrackPoint[]) => {
    await driver.putRun(run);
    if (points?.length) await driver.putPoints(run.id, points);
  },
  deleteRun: (id: string) => driver.deleteRun(id),
  points: (id: string) => driver.getPoints(id),
  profile: () => getJson<Profile>('profile', DEFAULT_PROFILE),
  saveProfile: (p: Profile) => driver.setKv('profile', JSON.stringify(p)),
  rewards: () => getJson<Reward[]>('rewards', DEFAULT_REWARDS),
  saveRewards: (r: Reward[]) => driver.setKv('rewards', JSON.stringify(r)),
  redemptions: () => getJson<Redemption[]>('redemptions', []),
  saveRedemptions: (r: Redemption[]) => driver.setKv('redemptions', JSON.stringify(r)),

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
    };
  },

  /** Replaces all data with the backup's contents. */
  async importBackup(data: unknown) {
    const b = data as Backup;
    if (!b || b.app !== 'questbound' || b.version !== 1 || !Array.isArray(b.runs)) {
      throw new Error('This file is not a QuestBound backup.');
    }
    await driver.clear();
    for (const r of b.runs) await db.saveRun(r, b.points?.[r.id]);
    await db.saveProfile({ ...DEFAULT_PROFILE, ...b.profile });
    await db.saveRewards(b.rewards ?? DEFAULT_REWARDS);
    await db.saveRedemptions(b.redemptions ?? []);
  },
};
