export interface AchievementContext {
  runCount: number;
  totalKm: number;
  longestKm: number;
  level: number;
  classesUsed: number;
  bossesDefeated: number;
  totalBosses: number;
  bestWeekStreak: number;
  best5kSec?: number;
}

export interface Achievement {
  id: string;
  name: string;
  icon: string;
  description: string;
  gold: number;
  /** Level-milestone badges are shown in their own row. */
  milestone?: boolean;
  target: number;
  value: (c: AchievementContext) => number;
}

const count = (id: string, name: string, icon: string, n: number, gold: number): Achievement => ({
  id,
  name,
  icon,
  description: n === 1 ? 'Complete your first run.' : `Complete ${n} runs.`,
  gold,
  target: n,
  value: (c) => c.runCount,
});

const single = (id: string, name: string, icon: string, km: number, gold: number): Achievement => ({
  id,
  name,
  icon,
  description: `Run ${km} km in a single run.`,
  gold,
  target: km,
  value: (c) => c.longestKm,
});

const total = (id: string, name: string, icon: string, km: number, gold: number): Achievement => ({
  id,
  name,
  icon,
  description: `Run ${km} km in total.`,
  gold,
  target: km,
  value: (c) => c.totalKm,
});

const level = (lvl: number, name: string, icon: string, gold: number): Achievement => ({
  id: `level-${lvl}`,
  name,
  icon,
  description: `Reach hero level ${lvl}.`,
  gold,
  milestone: true,
  target: lvl,
  value: (c) => c.level,
});

export const ACHIEVEMENTS: Achievement[] = [
  count('runs-1', 'First Steps', '👣', 1, 20),
  count('runs-10', 'Seasoned Traveler', '🎒', 10, 40),
  count('runs-50', 'Road Veteran', '🥾', 50, 100),
  count('runs-100', 'Living Legend', '📜', 100, 200),
  single('single-5', 'Five-Kilometer Knight', '🗡️', 5, 30),
  single('single-10', 'Ten-Kilometer Templar', '⚜️', 10, 60),
  single('single-21', 'Half-Marathon Hero', '🏅', 21.0975, 150),
  single('single-42', 'Marathon Mythic', '👑', 42.195, 400),
  total('total-50', 'Fifty Leagues', '🧭', 50, 50),
  total('total-100', 'Century Strider', '💯', 100, 100),
  total('total-500', 'Continental', '🌍', 500, 250),
  total('total-1000', 'World Walker', '🌌', 1000, 500),
  {
    id: 'all-classes',
    name: 'Master of Many',
    icon: '🎭',
    description: 'Complete a run as every class.',
    gold: 60,
    target: 4,
    value: (c) => c.classesUsed,
  },
  {
    id: 'first-boss',
    name: 'Monster Slayer',
    icon: '⚔️',
    description: 'Defeat your first boss.',
    gold: 40,
    target: 1,
    value: (c) => c.bossesDefeated,
  },
  {
    id: 'all-bosses',
    name: 'Realm Savior',
    icon: '🏆',
    description: 'Defeat every boss in the realm.',
    gold: 500,
    target: 8,
    value: (c) => c.bossesDefeated,
  },
  {
    id: 'streak-4',
    name: 'Steadfast',
    icon: '🔥',
    description: 'Keep a 4-week active streak (2+ runs per week).',
    gold: 60,
    target: 4,
    value: (c) => c.bestWeekStreak,
  },
  {
    id: 'streak-12',
    name: 'Unbreakable',
    icon: '💎',
    description: 'Keep a 12-week active streak.',
    gold: 200,
    target: 12,
    value: (c) => c.bestWeekStreak,
  },
  {
    id: 'sub-30-5k',
    name: 'Swift as the Wind',
    icon: '🌪️',
    description: 'Run 5 km in under 30 minutes.',
    gold: 80,
    target: 1,
    value: (c) => (c.best5kSec !== undefined && c.best5kSec < 30 * 60 ? 1 : 0),
  },
  level(5, 'Wanderer Crest', '🥉', 30),
  level(10, 'Adventurer Crest', '🥈', 60),
  level(20, 'Hero Crest', '🥇', 120),
  level(30, 'Legend Crest', '🏵️', 250),
  level(40, 'Mythic Crest', '🌟', 400),
];
