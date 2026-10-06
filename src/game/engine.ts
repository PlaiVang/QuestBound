import { ACHIEVEMENTS, type Achievement, type AchievementContext } from './achievements';
import { CLASSES, CLASS_IDS, INTERVAL_VARIABILITY, baselineFrom } from './classes';
import { DAILY_XP, WEEKLY_XP, dailyQuest, evaluateQuest, weeklyQuests, type QuestStatus } from './quests';
import { runClass, type ClassId, type Redemption, type Run } from './types';
import { REGIONS, type Boss, type Region } from './world';
import { addDays, dayKey, startOfDay, startOfWeek, weekKey } from '../lib/dates';
import { EFFORT_DISTANCES } from '../lib/geo';

// ---------- Leveling ----------

/** Total XP needed to reach `level` (level 1 = 0 XP, level 2 = 100, level 3 = 300, ...). */
export const xpForLevel = (level: number) => 50 * level * (level - 1);

export function levelForXp(xp: number): number {
  return Math.max(1, Math.floor((1 + Math.sqrt(1 + (0.08 * Math.max(0, xp)))) / 2));
}

export function levelProgress(xp: number) {
  const level = levelForXp(xp);
  const floor = xpForLevel(level);
  const next = xpForLevel(level + 1);
  return { level, current: xp - floor, needed: next - floor };
}

const TITLES: [number, string][] = [
  [40, 'Mythic'],
  [30, 'Legend'],
  [20, 'Hero'],
  [15, 'Champion'],
  [10, 'Adventurer'],
  [5, 'Wanderer'],
  [1, 'Squire'],
];

export const titleForLevel = (level: number) => TITLES.find(([l]) => level >= l)![1];

// ---------- Rules ----------

export const XP_PER_KM = 10;
export const XP_PER_MIN = 1;
export const GOLD_PER_KM = 5;
export const MIN_WEEKLY_CAP_KM = 20;
/** A week counts toward the streak when it has at least this many runs. */
export const ACTIVE_WEEK_RUNS = 2;

/**
 * Distance that earns XP after diminishing returns. Full XP up to the weekly cap,
 * half XP up to twice the cap, a quarter beyond that.
 */
export function effectiveKm(weekKmBefore: number, runKm: number, capKm: number): number {
  const bands: [number, number, number][] = [
    [0, capKm, 1],
    [capKm, capKm * 2, 0.5],
    [capKm * 2, Infinity, 0.25],
  ];
  const start = weekKmBefore;
  const end = weekKmBefore + runKm;
  return bands.reduce((sum, [lo, hi, rate]) => sum + Math.max(0, Math.min(end, hi) - Math.max(start, lo)) * rate, 0);
}

export function bossProgress(boss: Boss, run: Run): number {
  const { distanceM, timeLimitSec } = boss.goal;
  if (run.distanceM < distanceM) return Math.min(0.99, run.distanceM / distanceM);
  if (!timeLimitSec) return 1;
  const t = run.bestEfforts[distanceM] ?? (run.durationSec * distanceM) / run.distanceM;
  return t <= timeLimitSec ? 1 : timeLimitSec / t;
}

// ---------- Game view ----------

export interface RunResult {
  runId: string;
  cls: ClassId;
  baseXp: number;
  bonusXp: number;
  bonusReason: string | null;
  fatigueMultiplier: number;
  xp: number;
  gold: number;
  bossDefeated?: string;
  bossAttempt?: { bossId: string; progress: number };
  mapKm: number;
}

export interface ClassProgress {
  id: ClassId;
  xp: number;
  level: number;
  runs: number;
}

export interface BossState {
  boss: Boss;
  region: Region;
  status: 'locked' | 'active' | 'defeated';
  hpPercent: number;
  defeatedBy?: string;
}

export interface PersonalRecord {
  label: string;
  value: number;
  runId: string;
  kind: 'time' | 'distance' | 'elevation';
}

export interface AchievementStatus {
  achievement: Achievement;
  value: number;
  unlocked: boolean;
}

export interface GameView {
  runResults: Record<string, RunResult>;
  totalXp: number;
  level: number;
  levelCurrent: number;
  levelNeeded: number;
  title: string;
  classes: Record<ClassId, ClassProgress>;
  stats: { name: string; classId: ClassId; value: number }[];
  gold: { earned: number; spent: number; balance: number };
  totals: { runs: number; distanceM: number; durationSec: number };
  streak: { weeks: number; best: number; thisWeekRuns: number };
  thisWeek: { km: number; capKm: number };
  world: {
    positionKm: number;
    blockedKm: number;
    currentRegion: Region;
    nextRegion?: Region;
    bosses: BossState[];
  };
  quests: { daily: QuestStatus; weekly: QuestStatus[]; completedIds: string[] };
  achievements: AchievementStatus[];
  prs: PersonalRecord[];
}

function weekStreakEndingAt(weekCounts: Map<string, number>, weekStart: number): number {
  let streak = 0;
  let w = weekStart;
  while ((weekCounts.get(weekKey(w)) ?? 0) >= ACTIVE_WEEK_RUNS) {
    streak++;
    w = addDays(w, -7);
  }
  return streak;
}

export function computeGame(allRuns: Run[], redemptions: Redemption[], now = Date.now()): GameView {
  const runs = allRuns.slice().sort((a, b) => a.startedAt - b.startedAt);
  const runResults: Record<string, RunResult> = {};
  const classXp: Record<ClassId, number> = { ranger: 0, rogue: 0, paladin: 0, berserker: 0 };
  const classRuns: Record<ClassId, number> = { ranger: 0, rogue: 0, paladin: 0, berserker: 0 };
  const weekKm = new Map<string, number>();
  const weekCounts = new Map<string, number>();
  let totalXp = 0;
  let goldEarned = 0;
  let bestStreak = 0;

  // World travel
  const gates = REGIONS.filter((r) => r.boss);
  const defeated = new Map<string, string>();
  const bestAttempt = new Map<string, number>();
  let positionKm = 0;
  let blockedKm = 0;

  runs.forEach((run, idx) => {
    const cls = runClass(run);
    const km = run.distanceM / 1000;
    const minutes = run.durationSec / 60;
    const baseXp = km * XP_PER_KM + minutes * XP_PER_MIN;
    const week = startOfWeek(run.startedAt);
    const wk = weekKey(week);

    let bonusXp = 0;
    let bonusReason: string | null = null;
    if (cls === 'ranger' && km > 5) {
      bonusXp = 3 * (km - 5);
      bonusReason = `${CLASSES.ranger.name}: long-distance bonus`;
    } else if (cls === 'rogue') {
      const baseline = baselineFrom(runs.slice(0, idx));
      const pace = km > 0 ? run.durationSec / km : Infinity;
      if (pace <= baseline.paceSecPerKm * 0.95 || (run.paceVariability ?? 0) >= INTERVAL_VARIABILITY) {
        bonusXp = baseXp * 0.25;
        bonusReason = `${CLASSES.rogue.name}: speed bonus`;
      }
    } else if (cls === 'paladin') {
      const streak = weekStreakEndingAt(weekCounts, addDays(week, -7));
      const pct = Math.min(0.25, 0.05 * streak);
      if (pct > 0) {
        bonusXp = baseXp * pct;
        bonusReason = `${CLASSES.paladin.name}: ${streak}-week streak bonus`;
      }
    } else if (cls === 'berserker' && run.elevationGainM > 0) {
      bonusXp = run.elevationGainM / 5;
      bonusReason = `${CLASSES.berserker.name}: climbing bonus`;
    }

    let prior4 = 0;
    for (let i = 1; i <= 4; i++) prior4 += weekKm.get(weekKey(addDays(week, -7 * i))) ?? 0;
    const capKm = Math.max(MIN_WEEKLY_CAP_KM, (prior4 / 4) * 1.3);
    const before = weekKm.get(wk) ?? 0;
    const fatigueMultiplier = km > 0 ? effectiveKm(before, km, capKm) / km : 1;

    const xp = Math.round((baseXp + bonusXp) * fatigueMultiplier);
    const gold = Math.round(km * GOLD_PER_KM);
    totalXp += xp;
    goldEarned += gold;
    classXp[cls] += xp;
    classRuns[cls] += 1;
    weekKm.set(wk, before + km);
    weekCounts.set(wk, (weekCounts.get(wk) ?? 0) + 1);
    bestStreak = Math.max(bestStreak, weekStreakEndingAt(weekCounts, week));

    // Travel the map; one boss attempt per run.
    const result: RunResult = {
      runId: run.id,
      cls,
      baseXp: Math.round(baseXp),
      bonusXp: Math.round(bonusXp),
      bonusReason,
      fatigueMultiplier,
      xp,
      gold,
      mapKm: 0,
    };
    const startPos = positionKm;
    let remaining = km;
    let attempted = false;
    for (;;) {
      const gate = gates.find((g) => !defeated.has(g.boss!.id));
      if (!gate) {
        positionKm += remaining;
        break;
      }
      const toGate = gate.atKm - positionKm;
      if (remaining < toGate) {
        positionKm += remaining;
        break;
      }
      positionKm = gate.atKm;
      remaining -= toGate;
      if (attempted) {
        blockedKm += remaining;
        break;
      }
      attempted = true;
      const boss = gate.boss!;
      const progress = bossProgress(boss, run);
      bestAttempt.set(boss.id, Math.max(bestAttempt.get(boss.id) ?? 0, progress));
      result.bossAttempt = { bossId: boss.id, progress };
      if (progress >= 1) {
        defeated.set(boss.id, run.id);
        result.bossDefeated = boss.id;
        totalXp += boss.xp;
        goldEarned += boss.gold;
        classXp[cls] += boss.xp;
        continue;
      }
      blockedKm += remaining;
      break;
    }
    result.mapKm = positionKm - startPos;
    runResults[run.id] = result;
  });

  // Quests
  const byDay = new Map<string, Run[]>();
  const byWeek = new Map<string, Run[]>();
  for (const r of runs) {
    const d = dayKey(r.startedAt);
    const w = weekKey(r.startedAt);
    byDay.set(d, [...(byDay.get(d) ?? []), r]);
    byWeek.set(w, [...(byWeek.get(w) ?? []), r]);
  }
  const completedIds: string[] = [];
  const award = (s: QuestStatus) => {
    if (!s.complete) return;
    completedIds.push(s.quest.id);
    totalXp += s.quest.xp;
    goldEarned += s.quest.gold;
  };
  for (const dayRuns of byDay.values()) award(evaluateQuest(dailyQuest(startOfDay(dayRuns[0].startedAt)), dayRuns));
  for (const weekRuns of byWeek.values()) {
    for (const q of weeklyQuests(startOfWeek(weekRuns[0].startedAt))) award(evaluateQuest(q, weekRuns));
  }
  const today = startOfDay(now);
  const thisWeekStart = startOfWeek(now);
  const daily = evaluateQuest(dailyQuest(today), byDay.get(dayKey(today)) ?? []);
  const weekly = weeklyQuests(thisWeekStart).map((q) => evaluateQuest(q, byWeek.get(weekKey(thisWeekStart)) ?? []));

  // Level and classes
  const lp = levelProgress(totalXp);
  const classes = Object.fromEntries(
    CLASS_IDS.map((id) => [id, { id, xp: classXp[id], level: levelForXp(classXp[id]), runs: classRuns[id] }]),
  ) as Record<ClassId, ClassProgress>;
  const stats = CLASS_IDS.map((id) => ({
    name: CLASSES[id].stat,
    classId: id,
    value: 5 + 3 * (classes[id].level - 1),
  }));

  // Streak (this week still counts as "in progress", so fall back to last week's streak)
  const thisWeekRuns = weekCounts.get(weekKey(thisWeekStart)) ?? 0;
  const streakWeeks =
    thisWeekRuns >= ACTIVE_WEEK_RUNS
      ? weekStreakEndingAt(weekCounts, thisWeekStart)
      : weekStreakEndingAt(weekCounts, addDays(thisWeekStart, -7));

  let prior4 = 0;
  for (let i = 1; i <= 4; i++) prior4 += weekKm.get(weekKey(addDays(thisWeekStart, -7 * i))) ?? 0;

  // World state
  const bosses: BossState[] = [];
  let foundActive = false;
  for (const region of gates) {
    const boss = region.boss!;
    const defeatedBy = defeated.get(boss.id);
    let status: BossState['status'] = 'locked';
    if (defeatedBy) status = 'defeated';
    else if (!foundActive) {
      status = 'active';
      foundActive = true;
    }
    bosses.push({
      boss,
      region,
      status,
      defeatedBy,
      hpPercent: defeatedBy ? 0 : Math.round((1 - (bestAttempt.get(boss.id) ?? 0)) * 100),
    });
  }
  const currentRegion = [...REGIONS].reverse().find((r) => positionKm >= r.atKm && (!r.boss || defeated.has(r.boss.id))) ?? REGIONS[0];
  const nextRegion = REGIONS.find((r) => r.atKm > currentRegion.atKm);

  // Records
  const prs: PersonalRecord[] = [];
  const labels: Record<number, string> = { 1000: 'Fastest 1K', 5000: 'Fastest 5K', 10000: 'Fastest 10K', 21097: 'Fastest Half' };
  for (const m of EFFORT_DISTANCES) {
    let best: PersonalRecord | null = null;
    for (const r of runs) {
      const t = r.bestEfforts[m];
      if (t !== undefined && (!best || t < best.value)) best = { label: labels[m], value: t, runId: r.id, kind: 'time' };
    }
    if (best) prs.push(best);
  }
  const longest = runs.reduce<Run | null>((a, r) => (!a || r.distanceM > a.distanceM ? r : a), null);
  if (longest) prs.push({ label: 'Longest run', value: longest.distanceM, runId: longest.id, kind: 'distance' });
  const climb = runs.reduce<Run | null>((a, r) => (!a || r.elevationGainM > a.elevationGainM ? r : a), null);
  if (climb && climb.elevationGainM > 0)
    prs.push({ label: 'Biggest climb', value: climb.elevationGainM, runId: climb.id, kind: 'elevation' });

  // Achievements (gold only, to keep levels independent of badges)
  const totalDistance = runs.reduce((a, r) => a + r.distanceM, 0);
  const ctx: AchievementContext = {
    runCount: runs.length,
    totalKm: totalDistance / 1000,
    longestKm: (longest?.distanceM ?? 0) / 1000,
    level: lp.level,
    classesUsed: CLASS_IDS.filter((id) => classRuns[id] > 0).length,
    bossesDefeated: defeated.size,
    totalBosses: gates.length,
    bestWeekStreak: bestStreak,
    best5kSec: prs.find((p) => p.label === labels[5000])?.value,
  };
  const achievements = ACHIEVEMENTS.map((a) => {
    const value = a.value(ctx);
    return { achievement: a, value, unlocked: value >= a.target };
  });
  for (const a of achievements) if (a.unlocked) goldEarned += a.achievement.gold;

  const spent = redemptions.reduce((a, r) => a + r.cost, 0);

  return {
    runResults,
    totalXp,
    level: lp.level,
    levelCurrent: lp.current,
    levelNeeded: lp.needed,
    title: titleForLevel(lp.level),
    classes,
    stats,
    gold: { earned: goldEarned, spent, balance: goldEarned - spent },
    totals: { runs: runs.length, distanceM: totalDistance, durationSec: runs.reduce((a, r) => a + r.durationSec, 0) },
    streak: { weeks: streakWeeks, best: bestStreak, thisWeekRuns },
    thisWeek: {
      km: weekKm.get(weekKey(thisWeekStart)) ?? 0,
      capKm: Math.max(MIN_WEEKLY_CAP_KM, (prior4 / 4) * 1.3),
    },
    world: { positionKm, blockedKm, currentRegion, nextRegion, bosses },
    quests: { daily, weekly, completedIds },
    achievements,
    prs,
  };
}

export interface RunReport {
  result: RunResult;
  xpGained: number;
  goldGained: number;
  levelBefore: number;
  levelAfter: number;
  classLevelBefore: number;
  classLevelAfter: number;
  newAchievements: Achievement[];
  questsCompleted: number;
  questXp: number;
  bossDefeated?: Boss;
  newRecords: string[];
  regionReached?: Region;
}

/** What changed in the game because of one run. */
export function reportForRun(allRuns: Run[], runId: string, redemptions: Redemption[], now = Date.now()): RunReport | null {
  const run = allRuns.find((r) => r.id === runId);
  if (!run) return null;
  const without = allRuns.filter((r) => r.id !== runId);
  const before = computeGame(without, redemptions, now);
  const after = computeGame(allRuns, redemptions, now);
  const result = after.runResults[runId];
  const cls = result.cls;
  const beforeIds = new Set(before.achievements.filter((a) => a.unlocked).map((a) => a.achievement.id));
  const beforeQuests = new Set(before.quests.completedIds);
  const newQuests = after.quests.completedIds.filter((id) => !beforeQuests.has(id));
  const questXp = newQuests.reduce((a, id) => a + (id.startsWith('daily:') ? DAILY_XP : WEEKLY_XP), 0);
  const beforePrs = new Map(before.prs.map((p) => [p.label, p.runId]));
  const newRecords = after.prs.filter((p) => p.runId === runId && beforePrs.get(p.label) !== runId).map((p) => p.label);
  return {
    result,
    xpGained: after.totalXp - before.totalXp,
    goldGained: after.gold.earned - before.gold.earned,
    levelBefore: before.level,
    levelAfter: after.level,
    classLevelBefore: before.classes[cls].level,
    classLevelAfter: after.classes[cls].level,
    newAchievements: after.achievements.filter((a) => a.unlocked && !beforeIds.has(a.achievement.id)).map((a) => a.achievement),
    questsCompleted: newQuests.length,
    questXp,
    bossDefeated: result.bossDefeated ? REGIONS.find((r) => r.boss?.id === result.bossDefeated)!.boss : undefined,
    newRecords,
    regionReached: after.world.currentRegion.id !== before.world.currentRegion.id ? after.world.currentRegion : undefined,
  };
}
