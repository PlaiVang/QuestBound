import { CLASSES, CLASS_IDS } from './classes';
import { runClass, type Run } from './types';
import { dayKey, hashString, weekKey } from '../lib/dates';

export interface Quest {
  id: string;
  kind: 'daily' | 'weekly';
  periodKey: string;
  name: string;
  icon: string;
  description: string;
  target: number;
  /** Formats progress values, e.g. "3.2 / 5 km". */
  unit: 'km' | 'min' | 'runs' | 'classes' | 'done';
  xp: number;
  gold: number;
  measure: (runs: Run[]) => number;
}

export interface QuestStatus {
  quest: Quest;
  progress: number;
  complete: boolean;
}

const km = (runs: Run[]) => runs.reduce((a, r) => a + r.distanceM, 0) / 1000;
const minutes = (runs: Run[]) => runs.reduce((a, r) => a + r.durationSec, 0) / 60;
const longest = (runs: Run[]) => Math.max(0, ...runs.map((r) => r.distanceM / 1000));

type Template = Omit<Quest, 'id' | 'kind' | 'periodKey' | 'xp' | 'gold'>;

export const DAILY_XP = 15;
export const DAILY_GOLD = 10;
export const WEEKLY_XP = 50;
export const WEEKLY_GOLD = 30;

function dailyTemplates(seed: number): Template[] {
  const cls = CLASSES[CLASS_IDS[seed % 3]];
  return [
    {
      name: 'Morning Patrol',
      icon: '🌅',
      description: 'Run at least 2 km today.',
      target: 2,
      unit: 'km',
      measure: km,
    },
    {
      name: 'Road Warden',
      icon: '⏳',
      description: 'Spend 20 minutes on the road today.',
      target: 20,
      unit: 'min',
      measure: minutes,
    },
    {
      name: `${cls.name}'s Trial`,
      icon: cls.icon,
      description: `Complete a ${cls.name} run today (${cls.runType.toLowerCase()}).`,
      target: 1,
      unit: 'done',
      measure: (runs) => (runs.some((r) => runClass(r) === cls.id) ? 1 : 0),
    },
    {
      name: 'Long Watch',
      icon: '🌙',
      description: 'Run 5 km in total today.',
      target: 5,
      unit: 'km',
      measure: km,
    },
  ];
}

const WEEKLY_TEMPLATES: Template[] = [
  {
    name: 'Three Banners',
    icon: '🚩',
    description: 'Run 3 times this week.',
    target: 3,
    unit: 'runs',
    measure: (runs) => runs.length,
  },
  {
    name: 'Merchant Road',
    icon: '🛣️',
    description: 'Cover 15 km this week.',
    target: 15,
    unit: 'km',
    measure: km,
  },
  {
    name: 'Hour of Valor',
    icon: '⌛',
    description: 'Run 90 minutes in total this week.',
    target: 90,
    unit: 'min',
    measure: minutes,
  },
  {
    name: 'Jack of All Trades',
    icon: '🎭',
    description: 'Run as two different classes this week.',
    target: 2,
    unit: 'classes',
    measure: (runs) => new Set(runs.map(runClass)).size,
  },
  {
    name: 'The Long Road',
    icon: '🗺️',
    description: 'Complete a single run of 8 km or more.',
    target: 8,
    unit: 'km',
    measure: longest,
  },
  {
    name: 'Weekend Warrior',
    icon: '⚔️',
    description: 'Run on Saturday or Sunday.',
    target: 1,
    unit: 'done',
    measure: (runs) => (runs.some((r) => [0, 6].includes(new Date(r.startedAt).getDay())) ? 1 : 0),
  },
];

export function dailyQuest(dayStartMs: number): Quest {
  const key = dayKey(dayStartMs);
  const seed = hashString(`daily:${key}`);
  const templates = dailyTemplates(seed >>> 4);
  const t = templates[seed % templates.length];
  return { ...t, id: `daily:${key}`, kind: 'daily', periodKey: key, xp: DAILY_XP, gold: DAILY_GOLD };
}

export function weeklyQuests(weekStartMs: number): Quest[] {
  const key = weekKey(weekStartMs);
  const pool = WEEKLY_TEMPLATES.map((t, i) => ({ t, i }));
  pool.sort((a, b) => hashString(`${key}:${a.i}`) - hashString(`${key}:${b.i}`));
  return pool.slice(0, 3).map(({ t, i }) => ({
    ...t,
    id: `weekly:${key}:${i}`,
    kind: 'weekly',
    periodKey: key,
    xp: WEEKLY_XP,
    gold: WEEKLY_GOLD,
  }));
}

export function evaluateQuest(quest: Quest, runsInPeriod: Run[]): QuestStatus {
  const progress = quest.measure(runsInPeriod);
  return { quest, progress, complete: progress >= quest.target };
}
