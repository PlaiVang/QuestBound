export type ClassId = 'ranger' | 'rogue' | 'paladin' | 'berserker';

/** [latitude, longitude, timestampMs, altitudeM | null, segmentIndex] */
export type TrackPoint = [number, number, number, number | null, number];

/** Fastest moving time in seconds, keyed by distance in meters. */
export type BestEfforts = Partial<Record<number, number>>;

export interface Run {
  id: string;
  startedAt: number;
  durationSec: number;
  distanceM: number;
  elevationGainM: number;
  source: 'gps' | 'manual';
  autoClass: ClassId;
  classOverride?: ClassId;
  /** Seconds taken for each full kilometer. */
  splits: number[];
  bestEfforts: BestEfforts;
  /** Coefficient of variation of pace; higher means more interval-like. */
  paceVariability: number | null;
  notes?: string;
  heartRate?: { averageBpm: number; maxBpm: number; source: 'manual' | 'health-connect' };
  importedFrom?: 'samsung-health';
  simulated?: boolean;
  training?: { sessionId: string; completed: boolean };
}

export type Units = 'km' | 'mi';

export interface Profile {
  heroName: string;
  units: Units;
}

export interface Reward {
  id: string;
  name: string;
  icon: string;
  cost: number;
}

export interface Redemption {
  id: string;
  rewardId: string;
  name: string;
  icon: string;
  cost: number;
  at: number;
}

export const runClass = (run: Run): ClassId => run.classOverride ?? run.autoClass;
