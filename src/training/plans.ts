import type { Run } from '../game/types';
import { addDays, dayKey, startOfDay } from '../lib/dates';

export type PlanGoal = 'routine' | 'first-5k';
export type PhaseKind = 'warmup' | 'run' | 'walk' | 'cooldown';
export interface WorkoutPhase {
  kind: PhaseKind;
  seconds: number;
}
export interface PlannedWorkout {
  id: string;
  week: number;
  date: string;
  title: string;
  phases: WorkoutPhase[];
  skipped?: boolean;
}
export interface TrainingPlan {
  id: string;
  goal: PlanGoal;
  createdAt: number;
  days: number[];
  sessions: PlannedWorkout[];
}

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const PHASE_LABELS: Record<PhaseKind, string> = {
  warmup: 'Warm up with an easy walk',
  run: 'Run at a comfortable, conversational effort',
  walk: 'Recovery walk',
  cooldown: 'Cool down with an easy walk',
};
export const planName = (goal: PlanGoal) => goal === 'routine' ? 'Build your running routine' : 'Walk/run toward your first 5K';
export const workoutSeconds = (session: PlannedWorkout) => session.phases.reduce((sum, p) => sum + p.seconds, 0);

export function dateMs(date: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error('Choose a valid calendar date.');
  const [y, m, d] = date.split('-').map(Number);
  const ms = new Date(y, m - 1, d).getTime();
  if (dayKey(ms) !== date) throw new Error('Choose a valid calendar date.');
  return ms;
}

function validateDays(days: number[]) {
  if (days.length !== 3 || new Set(days).size !== 3 || days.some(d => !Number.isInteger(d) || d < 0 || d > 6)) {
    throw new Error('Choose exactly three training days.');
  }
  const sorted = [...days].sort((a, b) => a - b);
  if (sorted.some((d, i) => ((sorted[(i + 1) % 3] - d + 7) % 7) < 2)) {
    throw new Error('Leave at least one recovery day between sessions.');
  }
}

const easyPhases = (minutes: number): WorkoutPhase[] => [
  { kind: 'warmup', seconds: 300 },
  { kind: 'run', seconds: minutes * 60 },
  { kind: 'cooldown', seconds: 300 },
];

function beginnerPhases(week: number): WorkoutPhase[] {
  const intervals = [
    [60, 120, 6], [90, 120, 6], [120, 120, 6], [180, 120, 5],
    [300, 120, 3], [480, 120, 2], [720, 120, 2], [1800, 0, 1],
  ];
  const [run, walk, repeats] = intervals[week - 1];
  const phases: WorkoutPhase[] = [{ kind: 'warmup', seconds: 300 }];
  for (let i = 0; i < repeats; i++) {
    phases.push({ kind: 'run', seconds: run });
    if (walk > 0) phases.push({ kind: 'walk', seconds: walk });
  }
  phases.push({ kind: 'cooldown', seconds: 300 });
  return phases;
}

export function createPlan(input: {
  id: string; goal: PlanGoal; startDate: string; days: number[]; easyMinutes: number; now?: number;
}): TrainingPlan {
  validateDays(input.days);
  if (!['routine', 'first-5k'].includes(input.goal)) throw new Error('Choose a supported training goal.');
  if (![10, 20, 30].includes(input.easyMinutes)) throw new Error('Choose a supported easy-run duration.');
  const start = dateMs(input.startDate);
  const sessions: PlannedWorkout[] = [];
  let cursor = start;
  while (sessions.length < 24) {
    if (input.days.includes(new Date(cursor).getDay())) {
      const index = sessions.length;
      const week = Math.floor(index / 3) + 1;
      sessions.push({
        id: `${input.id}:${index + 1}`,
        week,
        date: dayKey(cursor),
        title: input.goal === 'first-5k' ? `Walk/run ${index % 3 + 1}` : index % 3 === 2 ? 'Easy exploration' : 'Easy run',
        phases: input.goal === 'first-5k' ? beginnerPhases(week) : easyPhases(input.easyMinutes),
      });
    }
    cursor = addDays(cursor, 1);
  }
  return { id: input.id, goal: input.goal, createdAt: input.now ?? Date.now(), days: [...input.days], sessions };
}

export function workoutProgress(session: PlannedWorkout, runs: Run[]) {
  const attempts = runs.filter(r => r.training?.sessionId === session.id);
  const completed = attempts.some(r => r.training?.completed);
  const elapsed = attempts.reduce((sum, r) => sum + r.durationSec, 0);
  const target = workoutSeconds(session);
  const status = completed ? 'completed' : session.skipped ? 'skipped' : 'pending';
  return { status, elapsed, progress: completed ? 1 : Math.min(0.99, elapsed / target), attempts };
}

export function currentPhase(session: PlannedWorkout, elapsedSec: number) {
  let start = 0;
  for (let index = 0; index < session.phases.length; index++) {
    const phase = session.phases[index];
    if (elapsedSec < start + phase.seconds) {
      return { phase, index, remaining: start + phase.seconds - elapsedSec, done: false };
    }
    start += phase.seconds;
  }
  return { phase: session.phases[session.phases.length - 1], index: session.phases.length, remaining: 0, done: true };
}

export function eligibleWorkouts(plan: TrainingPlan | null, runs: Run[], now = Date.now()) {
  return plan?.sessions.filter(s => workoutProgress(s, runs).status === 'pending' && dateMs(s.date) <= startOfDay(now)) ?? [];
}

export function rescheduleWorkout(plan: TrainingPlan, id: string, date: string, runs: Run[], now = Date.now()): TrainingPlan {
  const session = plan.sessions.find(s => s.id === id);
  if (!session || workoutProgress(session, runs).status !== 'pending') throw new Error('Only pending sessions can be moved.');
  const time = dateMs(date);
  if (time < startOfDay(now)) throw new Error('Choose today or a future date. There is no need to catch up.');
  if (plan.sessions.some(s => s.id !== id && !s.skipped && Math.abs(dateMs(s.date) - time) < 36 * 3600_000)) {
    throw new Error('Leave at least one recovery day between sessions; move or skip a nearby session first.');
  }
  return { ...plan, sessions: plan.sessions.map(s => s.id === id ? { ...s, date } : s) };
}

export function postponePending(plan: TrainingPlan, runs: Run[], startDate: string, now = Date.now()): TrainingPlan {
  const pending = plan.sessions.filter(s => workoutProgress(s, runs).status === 'pending');
  if (!pending.length) throw new Error('There are no pending sessions to move.');
  const earliest = Math.min(...pending.map(s => dateMs(s.date)));
  const newStart = dateMs(startDate);
  if (newStart < startOfDay(now)) throw new Error('Choose today or a future restart date.');
  if (newStart < earliest) throw new Error('The restart date cannot move sessions earlier.');
  // Calendar-day arithmetic preserves local dates across daylight-saving transitions.
  const days = Math.round((Date.UTC(...utcParts(newStart)) - Date.UTC(...utcParts(earliest))) / 86400000);
  const next = { ...plan, sessions: plan.sessions.map(s => workoutProgress(s, runs).status === 'pending'
    ? { ...s, date: dayKey(addDays(dateMs(s.date), days)) } : s) };
  const kept = next.sessions.filter(s => !s.skipped).sort((a, b) => dateMs(a.date) - dateMs(b.date));
  if (kept.some((s, i) => i > 0 && dateMs(s.date) - dateMs(kept[i - 1].date) < 36 * 3600_000)) {
    throw new Error('Choose a later restart date to leave a recovery day after your last session.');
  }
  return next;
}

function utcParts(ms: number): [number, number, number] {
  const d = new Date(ms);
  return [d.getFullYear(), d.getMonth(), d.getDate()];
}

export function linkWorkout(run: Run, session: PlannedWorkout, priorRuns: Run[], completed: boolean): Run {
  if (workoutProgress(session, priorRuns.filter(r => r.id !== run.id)).status !== 'pending') {
    throw new Error('This session is already completed or skipped. Choose another session.');
  }
  if (dateMs(session.date) > startOfDay(run.startedAt)) {
    throw new Error('This workout is scheduled after the run. Reschedule it before linking your log.');
  }
  return { ...run, training: { sessionId: session.id, completed } };
}

export function validatePlan(value: unknown): asserts value is TrainingPlan {
  if (!value || typeof value !== 'object') throw new Error('Invalid training plan.');
  const p = value as TrainingPlan;
  if (typeof p.id !== 'string' || !p.id || !['routine', 'first-5k'].includes(p.goal) ||
      !Number.isFinite(p.createdAt) || !Array.isArray(p.days) || !Array.isArray(p.sessions) || p.sessions.length !== 24) {
    throw new Error('Invalid training plan.');
  }
  validateDays(p.days);
  const ids = new Set<string>();
  for (const s of p.sessions) {
    if (!s || typeof s.id !== 'string' || !s.id || ids.has(s.id) || typeof s.title !== 'string' ||
        !Number.isInteger(s.week) || s.week < 1 || s.week > 8 ||
        (s.skipped !== undefined && typeof s.skipped !== 'boolean') ||
        !Array.isArray(s.phases) || !s.phases.length || s.phases.some(phase =>
          !phase || !['warmup', 'run', 'walk', 'cooldown'].includes(phase.kind) ||
          !Number.isFinite(phase.seconds) || phase.seconds <= 0 || phase.seconds > 7200)) {
      throw new Error('Invalid workout in the training plan.');
    }
    dateMs(s.date);
    ids.add(s.id);
  }
}
