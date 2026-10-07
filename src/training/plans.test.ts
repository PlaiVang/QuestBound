import { describe, expect, it } from 'vitest';
import { manualRun } from '../game/runFactory';
import { createPlan, currentPhase, dateMs, eligibleWorkouts, linkWorkout, postponePending, rescheduleWorkout, validatePlan, workoutProgress, workoutSeconds } from './plans';

const input = { id: 'plan', goal: 'first-5k' as const, startDate: '2026-10-05', days: [1, 3, 6], easyMinutes: 20, now: 1 };
const makeRun = (seconds: number, id = 'run') => ({
  ...manualRun({ startedAt: dateMs('2026-10-05'), distanceM: 1000, durationSec: seconds, elevationGainM: 0 }, []), id,
});

describe('training plans', () => {
  it('previews eight weeks of three spaced sessions without pace targets', () => {
    const plan = createPlan(input);
    expect(plan.sessions).toHaveLength(24);
    expect(plan.sessions.slice(0, 3).map(s => s.date)).toEqual(['2026-10-05', '2026-10-07', '2026-10-10']);
    expect(workoutSeconds(plan.sessions[0])).toBe(1680);
    expect(plan.sessions[21].phases.map(p => p.seconds)).toEqual([300, 1800, 300]);
    expect(() => validatePlan(plan)).not.toThrow();
  });
  it('keeps routine volume constant instead of escalating automatically', () => {
    const plan = createPlan({ ...input, goal: 'routine' });
    expect(new Set(plan.sessions.map(workoutSeconds))).toEqual(new Set([1800]));
  });
  it('rejects adjacent days, duplicates and invalid dates', () => {
    expect(() => createPlan({ ...input, days: [1, 2, 4] })).toThrow(/recovery/);
    expect(() => createPlan({ ...input, days: [1, 1, 4] })).toThrow(/three/);
    expect(() => dateMs('2026-02-30')).toThrow();
  });
  it('walk phases and pause-independent elapsed time select the correct instruction', () => {
    const session = createPlan(input).sessions[0];
    expect(currentPhase(session, 300).phase.kind).toBe('run');
    expect(currentPhase(session, 360).phase.kind).toBe('walk');
    expect(currentPhase(session, workoutSeconds(session)).done).toBe(true);
  });
  it('keeps partial attempts but does not treat extra time as completion', () => {
    const session = createPlan(input).sessions[0];
    const partial = linkWorkout(makeRun(3000), session, [], false);
    expect(workoutProgress(session, [partial]).status).toBe('pending');
    expect(workoutProgress(session, [partial]).progress).toBe(0.99);
    const complete = linkWorkout(makeRun(1200, 'second'), session, [partial], true);
    expect(workoutProgress(session, [partial, complete]).status).toBe('completed');
    expect(() => linkWorkout(makeRun(1200, 'third'), session, [complete], true)).toThrow(/already/);
  });
  it('offers only due pending sessions and allows manual completion without speed requirements', () => {
    const plan = createPlan(input);
    expect(eligibleWorkouts(plan, [], dateMs('2026-10-06')).length).toBe(1);
    const completed = linkWorkout(makeRun(2000), plan.sessions[0], [], true);
    expect(eligibleWorkouts(plan, [completed], dateMs('2026-10-06')).length).toBe(0);
  });
  it('reschedules without doubling up and preserves progress on restart', () => {
    const plan = createPlan(input);
    expect(() => rescheduleWorkout(plan, 'plan:1', '2026-10-06', [], dateMs('2026-10-05'))).toThrow(/recovery/);
    const next = postponePending(plan, [], '2026-10-12', dateMs('2026-10-05'));
    expect(next.sessions[0].date).toBe('2026-10-12');
    expect(next.sessions[0].id).toBe(plan.sessions[0].id);
    expect(next.sessions[0].phases).toEqual(plan.sessions[0].phases);
    expect(() => postponePending(plan, [], '2026-10-12', dateMs('2026-10-20'))).toThrow(/future/);
  });
  it('rejects corrupted imported phases before persistence', () => {
    const plan = createPlan(input);
    plan.sessions[0].phases[0].seconds = -1;
    expect(() => validatePlan(plan)).toThrow(/workout/);
  });
});
