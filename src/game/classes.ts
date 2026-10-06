import type { ClassId, Run } from './types';

export interface ClassDef {
  id: ClassId;
  name: string;
  icon: string;
  color: string;
  runType: string;
  stat: string;
  description: string;
  bonusText: string;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  ranger: {
    id: 'ranger',
    name: 'Ranger',
    icon: '🏹',
    color: '#4caf50',
    runType: 'Easy & long runs',
    stat: 'Endurance',
    description: 'Wanders far at a steady, easy effort.',
    bonusText: '+3 XP per km beyond 5 km',
  },
  rogue: {
    id: 'rogue',
    name: 'Rogue',
    icon: '🗡️',
    color: '#e53935',
    runType: 'Speed, tempo & intervals',
    stat: 'Speed',
    description: 'Strikes fast with tempo efforts and sprints.',
    bonusText: '+25% XP when faster than your usual pace or interval-like',
  },
  paladin: {
    id: 'paladin',
    name: 'Paladin',
    icon: '🛡️',
    color: '#fbc02d',
    runType: 'Recovery & steady runs',
    stat: 'Stamina',
    description: 'Shows up again and again. Consistency is power.',
    bonusText: '+5% XP per active-week streak (max +25%)',
  },
  berserker: {
    id: 'berserker',
    name: 'Berserker',
    icon: '🪓',
    color: '#8e24aa',
    runType: 'Hills & hard efforts',
    stat: 'Strength',
    description: 'Charges up hills without hesitation.',
    bonusText: '+1 XP per 5 m of climbing',
  },
};

export const CLASS_IDS = Object.keys(CLASSES) as ClassId[];

export interface RunFeatures {
  distanceM: number;
  durationSec: number;
  elevationGainM: number;
  paceVariability: number | null;
}

export interface Baseline {
  /** Typical pace in seconds per km. */
  paceSecPerKm: number;
  /** Typical distance in meters. */
  distanceM: number;
}

export const DEFAULT_BASELINE: Baseline = { paceSecPerKm: 390, distanceM: 5000 };

const median = (xs: number[]) => {
  const s = xs.slice().sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

/** Baseline from the most recent prior runs (up to 10). */
export function baselineFrom(priorRuns: Run[]): Baseline {
  const recent = priorRuns.filter((r) => r.distanceM >= 1000 && r.durationSec > 0).slice(-10);
  if (recent.length < 3) return DEFAULT_BASELINE;
  return {
    paceSecPerKm: median(recent.map((r) => (r.durationSec * 1000) / r.distanceM)),
    distanceM: median(recent.map((r) => r.distanceM)),
  };
}

export const INTERVAL_VARIABILITY = 0.15;

export function classifyRun(f: RunFeatures, baseline: Baseline): ClassId {
  const km = f.distanceM / 1000;
  const pace = km > 0 ? f.durationSec / km : Infinity;
  if (km >= 1 && f.elevationGainM / km >= 15) return 'berserker';
  if ((f.paceVariability ?? 0) >= INTERVAL_VARIABILITY) return 'rogue';
  if (pace <= baseline.paceSecPerKm * 0.93) return 'rogue';
  if (f.durationSec >= 60 * 60 || km >= 10 || f.distanceM >= baseline.distanceM * 1.4) return 'ranger';
  return 'paladin';
}
