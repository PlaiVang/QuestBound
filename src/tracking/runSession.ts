import { TrackAccumulator, type RawFix } from '../lib/geo';
import type { TrackPoint } from '../game/types';
import { createPositionSource, type PositionSource } from './positionSource';
import { uid } from '../lib/format';

export type SessionStatus = 'idle' | 'running' | 'paused';

export interface SessionSnapshot {
  status: SessionStatus;
  startedAt: number | null;
  movingMs: number;
  distanceM: number;
  points: TrackPoint[];
  lastAccuracy: number | null;
  lastFixAt: number | null;
  error: string | null;
  workoutId: string | null;
}

interface Persisted {
  runId?: string;
  startedAt: number;
  activeMs: number;
  resumedAt: number | null;
  points: TrackPoint[];
  workoutId?: string | null;
}

const STORAGE_KEY = 'questbound:active-run';
const PERSIST_EVERY_MS = 5000;

/**
 * The single live run. It lives outside React so a run keeps going while the user
 * browses other screens, and it is saved periodically so a crashed or killed app
 * can recover the run.
 */
class RunSession {
  private source: PositionSource = createPositionSource();
  private track = new TrackAccumulator();
  private status: SessionStatus = 'idle';
  private startedAt: number | null = null;
  private activeMs = 0;
  private resumedAt: number | null = null;
  private lastAccuracy: number | null = null;
  private lastFixAt: number | null = null;
  private error: string | null = null;
  private workoutId: string | null = null;
  private runId: string | null = null;
  private lastPersist = 0;
  private listeners = new Set<() => void>();
  private snapshot: SessionSnapshot = this.buildSnapshot();

  subscribe = (fn: () => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  getSnapshot = () => this.snapshot;
  checkpoint = () => this.persist();

  /** Moving time, including the time elapsed since the last resume. */
  movingMs(now = Date.now()) {
    return this.activeMs + (this.status === 'running' && this.resumedAt ? now - this.resumedAt : 0);
  }

  private buildSnapshot(): SessionSnapshot {
    return {
      status: this.status,
      startedAt: this.startedAt,
      movingMs: this.movingMs(),
      distanceM: this.track.distanceM,
      points: this.track.points.slice(),
      lastAccuracy: this.lastAccuracy,
      lastFixAt: this.lastFixAt,
      error: this.error,
      workoutId: this.workoutId,
    };
  }

  private emit() {
    this.snapshot = this.buildSnapshot();
    this.listeners.forEach((fn) => fn());
  }

  private persist(force = false) {
    const now = Date.now();
    if (!force && now - this.lastPersist < PERSIST_EVERY_MS) return;
    this.lastPersist = now;
    if (this.status === 'idle' || this.startedAt === null) {
      localStorage.removeItem(STORAGE_KEY);
      return;
    }
    const data: Persisted = {
      runId: this.runId ?? undefined,
      startedAt: this.startedAt,
      activeMs: this.movingMs(now),
      resumedAt: null,
      points: this.track.points,
      workoutId: this.workoutId,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  private onFix = (fix: RawFix) => {
    this.lastAccuracy = fix.accuracy;
    this.lastFixAt = Date.now();
    this.error = null;
    if (this.status === 'running') this.track.add(fix);
    this.persist();
    this.emit();
  };

  private onError = (message: string) => {
    this.error = message;
    this.emit();
  };

  async start(workoutId: string | null = null) {
    if (this.status !== 'idle') return;
    this.track = new TrackAccumulator();
    this.startedAt = Date.now();
    this.activeMs = 0;
    this.resumedAt = Date.now();
    this.status = 'running';
    this.error = null;
    this.workoutId = workoutId;
    this.runId = uid();
    this.persist(true);
    this.emit();
    try {
      await this.source.start(this.onFix, this.onError);
    } catch (e) {
      this.onError(e instanceof Error ? e.message : 'Unable to start GPS tracking.');
    }
  }

  pause() {
    if (this.status !== 'running') return;
    this.activeMs = this.movingMs();
    this.resumedAt = null;
    this.status = 'paused';
    this.track.newSegment();
    this.persist(true);
    this.emit();
  }

  resume() {
    if (this.status !== 'paused') return;
    this.resumedAt = Date.now();
    this.status = 'running';
    this.persist(true);
    this.emit();
  }

  /** Pause first; keep recovery data until the caller has successfully saved it. */
  async finish() {
    this.pause();
    return { id: this.runId ?? uid(), startedAt: this.startedAt ?? Date.now(), movingSec: this.movingMs() / 1000, points: this.track.points };
  }

  async discard() {
    await this.source.stop();
    this.status = 'idle';
    this.startedAt = null;
    this.activeMs = 0;
    this.resumedAt = null;
    this.error = null;
    this.workoutId = null;
    this.runId = null;
    this.track = new TrackAccumulator();
    this.persist(true);
    this.emit();
  }

  /** Restore a run that was in progress when the app was closed. Returns true if restored. */
  async restore(): Promise<boolean> {
    if (this.status !== 'idle') return true;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return false;
    try {
      const data = JSON.parse(raw) as Persisted;
      this.startedAt = data.startedAt;
      this.workoutId = data.workoutId ?? null;
      this.runId = data.runId ?? uid();
      this.track = TrackAccumulator.from(data.points);
      this.track.newSegment();
      // Time while the app was dead is not counted; the run resumes paused.
      this.activeMs = data.activeMs + (data.resumedAt ? Math.max(0, (data.points.at(-1)?.[2] ?? data.resumedAt) - data.resumedAt) : 0);
      this.resumedAt = null;
      this.status = 'paused';
      this.persist(true);
      this.emit();
      await this.source.start(this.onFix, this.onError).catch((e: unknown) =>
        this.onError(e instanceof Error ? e.message : 'Unable to start GPS tracking.'),
      );
      return true;
    } catch {
      localStorage.removeItem(STORAGE_KEY);
      return false;
    }
  }
}

export const runSession = new RunSession();
