import { describe, expect, it } from 'vitest';
import { classifyRun, DEFAULT_BASELINE } from './classes';
import { bossProgress, computeGame, effectiveKm, levelForXp, reportForRun, xpForLevel } from './engine';
import { manualRun } from './runFactory';
import type { Run } from './types';
import { BOSSES, REGIONS } from './world';
import { addDays, startOfWeek } from '../lib/dates';

const DAY = 86400000;
// A Wednesday at noon, so test runs stay inside one week unless spread on purpose.
const NOW = new Date(2026, 8, 30, 12).getTime();

function run(daysAgo: number, km: number, minutes: number, extra: Partial<Run> = {}): Run {
  const r = manualRun(
    { startedAt: NOW - daysAgo * DAY, distanceM: km * 1000, durationSec: minutes * 60, elevationGainM: 0 },
    [],
  );
  return { ...r, ...extra };
}

describe('leveling', () => {
  it('uses a growing XP curve', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(300);
    expect(levelForXp(0)).toBe(1);
    expect(levelForXp(99)).toBe(1);
    expect(levelForXp(100)).toBe(2);
    expect(levelForXp(299)).toBe(2);
    expect(levelForXp(300)).toBe(3);
  });
});

describe('classification', () => {
  it('assigns classes by run type', () => {
    const b = DEFAULT_BASELINE;
    expect(classifyRun({ distanceM: 12000, durationSec: 80 * 60, elevationGainM: 20, paceVariability: 0.05 }, b)).toBe('ranger');
    expect(classifyRun({ distanceM: 5000, durationSec: 25 * 60, elevationGainM: 10, paceVariability: 0.05 }, b)).toBe('rogue');
    expect(classifyRun({ distanceM: 5000, durationSec: 34 * 60, elevationGainM: 10, paceVariability: 0.3 }, b)).toBe('rogue');
    expect(classifyRun({ distanceM: 5000, durationSec: 35 * 60, elevationGainM: 120, paceVariability: 0.05 }, b)).toBe('berserker');
    expect(classifyRun({ distanceM: 4000, durationSec: 30 * 60, elevationGainM: 0, paceVariability: 0.05 }, b)).toBe('paladin');
  });
});

describe('diminishing returns', () => {
  it('gives full XP under the cap and less above it', () => {
    expect(effectiveKm(0, 10, 20)).toBe(10);
    expect(effectiveKm(15, 10, 20)).toBe(5 + 2.5);
    expect(effectiveKm(45, 10, 20)).toBe(2.5);
  });

  it('reduces XP for runs far above the weekly cap', () => {
    const fresh = computeGame([run(0, 10, 60, { autoClass: 'paladin' })], [], NOW);
    const tired = computeGame(
      [run(1, 20, 120, { autoClass: 'paladin' }), run(0, 10, 60, { autoClass: 'paladin', id: 'x' })],
      [],
      NOW,
    );
    expect(tired.runResults.x.fatigueMultiplier).toBeLessThan(1);
    expect(tired.runResults.x.xp).toBeLessThan(Object.values(fresh.runResults)[0].xp);
  });
});

describe('computeGame', () => {
  it('awards XP and gold for a run, and respects class overrides', () => {
    const r = run(0, 5, 30, { autoClass: 'paladin' });
    const game = computeGame([r], [], NOW);
    const res = game.runResults[r.id];
    expect(res.baseXp).toBe(80);
    expect(res.gold).toBe(25);
    expect(game.classes.paladin.runs).toBe(1);

    const overridden = computeGame([{ ...r, classOverride: 'ranger' }], [], NOW);
    expect(overridden.classes.ranger.runs).toBe(1);
    expect(overridden.classes.paladin.runs).toBe(0);
  });

  it('subtracts redeemed rewards from gold but never from XP', () => {
    const r = run(0, 5, 30);
    const base = computeGame([r], [], NOW);
    const spent = computeGame([r], [{ id: '1', rewardId: 'a', name: 'a', icon: 'a', cost: 10, at: NOW }], NOW);
    expect(spent.gold.balance).toBe(base.gold.balance - 10);
    expect(spent.totalXp).toBe(base.totalXp);
    expect(spent.level).toBe(base.level);
  });

  it('blocks map travel at a boss until it is defeated', () => {
    // 2 km short runs: the Goblin Scout needs 3 km in one run.
    const runs = [run(3, 2, 14), run(2, 2, 14), run(1, 2, 14)];
    const game = computeGame(runs, [], NOW);
    expect(game.world.positionKm).toBe(5);
    expect(game.world.blockedKm).toBeCloseTo(1, 5);
    const goblin = game.world.bosses[0];
    expect(goblin.status).toBe('active');
    expect(goblin.hpPercent).toBe(33);

    const win = computeGame([...runs, run(0, 3.5, 22, { id: 'win' })], [], NOW);
    expect(win.world.bosses[0].status).toBe('defeated');
    expect(win.world.bosses[0].defeatedBy).toBe('win');
    expect(win.world.positionKm).toBeCloseTo(8.5, 5);
    expect(win.world.currentRegion.id).toBe('whispering-woods');
  });

  it('judges timed bosses on best efforts', () => {
    const golem = BOSSES.find((b) => b.id === 'stone-golem')!;
    expect(bossProgress(golem, run(0, 5, 34))).toBe(1);
    expect(bossProgress(golem, run(0, 5, 40))).toBeCloseTo(35 / 40, 5);
    expect(bossProgress(golem, run(0, 2.5, 10))).toBeCloseTo(0.5, 5);
  });

  it('tracks the weekly streak with rest days allowed', () => {
    const thisWeek = startOfWeek(NOW);
    const runs: Run[] = [];
    for (let w = 1; w <= 3; w++) {
      const weekStart = addDays(thisWeek, -7 * w);
      runs.push(run((NOW - addDays(weekStart, 1)) / DAY, 3, 20), run((NOW - addDays(weekStart, 4)) / DAY, 3, 20));
    }
    const game = computeGame(runs, [], NOW);
    expect(game.streak.weeks).toBe(3);
    expect(game.streak.best).toBe(3);
  });

  it('computes personal records', () => {
    const game = computeGame([run(2, 5, 30), run(1, 10, 55), run(0, 5, 26)], [], NOW);
    const fast5k = game.prs.find((p) => p.label === 'Fastest 5K')!;
    expect(fast5k.value).toBe(26 * 60);
    expect(game.prs.find((p) => p.label === 'Longest run')!.value).toBe(10000);
  });

  it('unlocks achievements and level milestone badges', () => {
    const game = computeGame([run(0, 5, 30)], [], NOW);
    const unlocked = game.achievements.filter((a) => a.unlocked).map((a) => a.achievement.id);
    expect(unlocked).toContain('runs-1');
    expect(unlocked).toContain('single-5');
    expect(unlocked).not.toContain('level-5');
  });

  it('reports what a new run changed', () => {
    const prior = [run(2, 2, 14), run(1, 2, 14)];
    const latest = run(0, 4, 26, { id: 'latest' });
    const report = reportForRun([...prior, latest], 'latest', [], NOW)!;
    expect(report.bossDefeated?.id).toBe('goblin-scout');
    expect(report.xpGained).toBeGreaterThanOrEqual(report.result.xp + report.bossDefeated!.xp);
    expect(report.regionReached?.id).toBe(REGIONS[1].id);
  });
});
