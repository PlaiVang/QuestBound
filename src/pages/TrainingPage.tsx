import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bar } from '../components/ui';
import { dayKey } from '../lib/dates';
import { formatDuration, uid } from '../lib/format';
import { useGame } from '../state/GameContext';
import {
  createPlan, DAY_NAMES, dateMs, PHASE_LABELS, planName, postponePending, rescheduleWorkout,
  workoutProgress, workoutSeconds, type PlanGoal, type TrainingPlan,
} from '../training/plans';
import { runSession } from '../tracking/runSession';
import { useRunSession } from '../tracking/useRunSession';
import { TrainingCalendar } from '../components/TrainingCalendar';

export function TrainingPage() {
  const { trainingPlan: plan, runs, saveTrainingPlan } = useGame();
  const navigate = useNavigate();
  const live = useRunSession();
  const [goal, setGoal] = useState<PlanGoal>('routine');
  const [days, setDays] = useState([1, 3, 6]);
  const [startDate, setStartDate] = useState(() => dayKey(Date.now()));
  const [minutes, setMinutes] = useState(20);
  const [restartDate, setRestartDate] = useState(() => dayKey(Date.now()));
  const [dates, setDates] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [newPlan, setNewPlan] = useState(false);

  const preview = useMemo(() => {
    try {
      return { plan: createPlan({ id: 'preview', goal, startDate, days, easyMinutes: minutes, now: 0 }), error: '' };
    } catch (e) {
      return { plan: null, error: e instanceof Error ? e.message : 'Unable to preview this schedule.' };
    }
  }, [goal, startDate, days, minutes]);

  const persist = async (make: () => TrainingPlan, success: string) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await runSession.restore();
      if (runSession.getSnapshot().status !== 'idle') {
        throw new Error('Finish or discard your active run before changing the schedule.');
      }
      await saveTrainingPlan(make());
      setMessage(success);
      setNewPlan(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The schedule could not be saved. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const create = (event: FormEvent) => {
    event.preventDefault();
    if (live.status !== 'idle') {
      setError('Finish or discard your active run before changing plans.');
      return;
    }
    if (dateMs(startDate) < dateMs(dayKey(Date.now()))) {
      setError('Start today or in the future. You do not need to make up past sessions.');
      return;
    }
    if (plan && !window.confirm('Replace your current schedule? Your saved runs and earned progress stay, but unfinished sessions in this schedule will be replaced.')) return;
    void persist(() => createPlan({ id: uid(), goal, startDate, days, easyMinutes: minutes }), 'Your plan is ready.');
  };

  const startWorkout = async (id: string) => {
    setBusy(true);
    setError('');
    try {
      await runSession.restore();
      if (runSession.getSnapshot().status !== 'idle') {
        throw new Error('A run is already active. Return to Run to finish or discard it before starting another session.');
      }
      const session = plan?.sessions.find(s => s.id === id);
      if (!plan || !session || workoutProgress(session, runs).status !== 'pending') {
        throw new Error('This session is no longer available. Choose an unfinished session.');
      }
      if (session.date > dayKey(Date.now())) {
        if (!window.confirm('Move this session to today and start it? Recovery spacing will be checked before saving the change.')) return;
        await saveTrainingPlan(rescheduleWorkout(plan, id, dayKey(Date.now()), runs));
      }
      if (await runSession.start(id)) navigate(`/run?workout=${encodeURIComponent(id)}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to start this session. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const completed = plan?.sessions.filter(s => workoutProgress(s, runs).status === 'completed').length ?? 0;
  const pending = plan?.sessions.filter(s => workoutProgress(s, runs).status === 'pending') ?? [];
  const next = [...pending].sort((a, b) => a.date.localeCompare(b.date))[0];
  const today = dayKey(Date.now());
  const formatDay = (date: string) => new Date(dateMs(date)).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });

  return (
    <>
      <h1>Training journal</h1>
      {error && <p className="toast" role="alert">{error}</p>}
      {message && <p role="status" className="small">{message}</p>}
      <p className="small muted">Your schedule leads the adventure. Easy means you can talk in full sentences; walking is welcome.
        Stop if you feel pain or unwell. These general templates are not individualized medical or coaching advice.</p>
      <TrainingCalendar plan={plan} runs={runs} busy={busy || live.status !== 'idle'} onStart={id => void startWorkout(id)} />

      {(!plan || newPlan) ? (
        <form onSubmit={create} className="panel">
          <h2>Choose your starting point</h2>
          <label className="field">
            <span>Goal</span>
            <select value={goal} onChange={e => setGoal(e.target.value === 'first-5k' ? 'first-5k' : 'routine')}>
              <option value="routine">Build a consistent running routine</option>
              <option value="first-5k">Walk/run toward a first 5K</option>
            </select>
          </label>
          <p className="small">{goal === 'routine'
            ? 'For runners already comfortable with easy running. Eight weeks at a duration you choose, without automatic increases.'
            : 'For beginners comfortable walking for about 30 minutes. Eight weeks of walk/run sessions build toward 30 minutes of easy running, not a guaranteed 5K distance. Repeat or reduce a week whenever needed.'}</p>
          {goal === 'routine' && <label className="field">
            <span>Comfortable running time (plus 10 minutes warming up and cooling down)</span>
            <select value={minutes} onChange={e => setMinutes(Number(e.target.value))}>
              <option value={10}>10 minutes</option><option value={20}>20 minutes</option><option value={30}>30 minutes</option>
            </select>
          </label>}
          <fieldset className="training-days">
            <legend>Choose three days with recovery days between them</legend>
            <div className="row wrap">
              {DAY_NAMES.map((day, index) => <label key={day} className="day-choice">
                <input type="checkbox" checked={days.includes(index)} onChange={e =>
                  setDays(e.target.checked ? [...days, index] : days.filter(d => d !== index))} />
                {day}
              </label>)}
            </div>
          </fieldset>
          <label className="field">
            <span>Start on or after</span>
            <input type="date" min={today} value={startDate} onChange={e => setStartDate(e.target.value)} required />
          </label>
          {preview.error && <p className="small" role="status">{preview.error}</p>}
          {preview.plan && <details className="training-preview" open>
            <summary>Preview all eight weeks</summary>
            <ol className="training-preview-list">
              {Array.from({ length: 8 }, (_, i) => {
                const sessions = preview.plan.sessions.filter(s => s.week === i + 1);
                return <li key={i}>
                  <b>Week {i + 1}</b> · {sessions.map(s => formatDay(s.date)).join(' / ')}
                  <div className="small muted">{formatDuration(workoutSeconds(sessions[0]))} each, including warm-up and cooldown</div>
                  <div className="small">{sessions[0].phases.filter(p => p.kind === 'run').length} running block(s) ·
                    {' '}{formatDuration(sessions[0].phases.find(p => p.kind === 'run')!.seconds)} per block
                    {goal === 'first-5k' && i < 7 && ' · recovery walks between blocks'}</div>
                </li>;
              })}
            </ol>
          </details>}
          <button className="btn primary block" disabled={busy || !preview.plan} type="submit">{busy ? 'Saving...' : 'Use this plan'}</button>
          {newPlan && <button type="button" className="btn ghost block" onClick={() => setNewPlan(false)}>Keep current plan</button>}
        </form>
      ) : (
        <>
          <section className="panel">
            <h2>{planName(plan.goal)}</h2>
            <Bar value={completed} max={24} label={`${completed} of 24 sessions completed`} />
            <p className="small">No streak penalties or catch-up workouts. Your logged progress stays when you move the schedule.</p>
            <button className="btn block" disabled={busy || live.status !== 'idle'} onClick={() => setNewPlan(true)}>Change training plan</button>
            <p className="small muted">You can switch plans at any time between runs. Only one schedule is active; saved run history and earned progress stay.</p>
            {next ? <>
              <p className="small"><b>Next session:</b> {next.title} · {formatDay(next.date)} · {formatDuration(workoutSeconds(next))}</p>
              <button className="btn primary block" disabled={busy || live.status !== 'idle'} onClick={() => void startWorkout(next.id)}>
                {next.date <= today ? 'Start planned run' : 'Move to today & start'}
              </button>
              {next.date > today && <p className="small muted">Starting early moves this session to today only if a recovery day remains between sessions.</p>}
            </> : <>
              <p>You've reached the end of this schedule. Your runs remain in your journal.</p>
              <button className="btn primary" onClick={() => setNewPlan(true)}>Preview a new plan</button>
            </>}
          </section>

          {pending.length > 0 && <section className="panel">
            <h2>Return on your terms</h2>
            <p className="small muted">Move all unfinished sessions forward together, keeping their spacing and difficulty. No missed sessions will be piled onto one day.</p>
            <label className="field"><span>New date for the earliest unfinished session</span>
              <input type="date" min={today} value={restartDate} onChange={e => setRestartDate(e.target.value)} /></label>
            <button className="btn block" disabled={busy || !restartDate} onClick={() =>
              void persist(() => postponePending(plan, runs, restartDate), 'Schedule moved. Welcome back.')}>Move remaining schedule</button>
          </section>}

          {Array.from({ length: 8 }, (_, index) => {
            const week = index + 1;
            const sessions = plan.sessions.filter(s => s.week === week);
            const weekDone = sessions.filter(s => workoutProgress(s, runs).status === 'completed').length;
            return <details className="panel training-week" key={week} open={next?.week === week}>
              <summary>Week {week} · {weekDone} / 3 completed</summary>
              <p className="small muted">{weekDone === 3 ? 'Milestone reached. Three planned sessions completed, at your own pace.' : 'Three sessions, with recovery between them. Speed is not a completion requirement.'}</p>
              {plan.goal === 'first-5k' && pending.some(s => s.week >= week) && <button className="btn small" disabled={busy} onClick={() =>
                void persist(() => ({ ...plan, sessions: plan.sessions.map(s =>
                  s.week >= week && workoutProgress(s, runs).status === 'pending' ? { ...s, phases: sessions[0].phases.map(p => ({ ...p })) } : s),
                }), `Remaining sessions now use week ${week}'s difficulty.`)}>Keep this difficulty for remaining weeks</button>}
              <ul className="training-sessions">
                {sessions.map(session => {
                  const progress = workoutProgress(session, runs);
                  const available = progress.status === 'pending';
                  return <li key={session.id}>
                    <h3>{session.title}</h3>
                    <p className="small">{formatDay(session.date)} · {formatDuration(workoutSeconds(session))}</p>
                    <span className="chip">{progress.status === 'completed' ? 'Completed' : progress.status === 'skipped' ? 'Skipped without penalty'
                      : session.date < today ? 'Ready when you are' : 'Planned'}</span>
                    {progress.attempts.length > 0 && <p className="small">
                      {progress.status === 'completed' ? 'Session completed.' : `${Math.round(progress.progress * 100)}% time progress saved; finish only when appropriate.`}
                      {' '}<Link to={`/runs/${progress.attempts.at(-1)!.id}`}>View log</Link>
                    </p>}
                    <details className="small training-instructions"><summary>Workout instructions</summary>
                      <ol>{session.phases.map((phase, i) => <li key={i}>{PHASE_LABELS[phase.kind]} · {formatDuration(phase.seconds)}</li>)}</ol>
                    </details>
                    {available && <div className="row wrap">
                      <button className="btn small primary" disabled={busy || live.status !== 'idle'} onClick={() => void startWorkout(session.id)}>
                        {session.date <= today ? 'Start run' : 'Move to today & start'}
                      </button>
                      {session.date <= today && <Link className="btn small" to={`/run/manual?workout=${encodeURIComponent(session.id)}`}>Log manually</Link>}
                    </div>}
                    {progress.status !== 'completed' && <details className="training-adjust small">
                      <summary>{progress.status === 'skipped' ? 'Restore session' : 'Adjust or skip session'}</summary>
                      <label className="field"><span>New date for {session.title}</span>
                        <input type="date" min={today} value={dates[session.id] ?? session.date} onChange={e =>
                          setDates({ ...dates, [session.id]: e.target.value })} /></label>
                      <div className="row wrap">
                        <button className="btn small" disabled={busy} onClick={() =>
                          void persist(() => rescheduleWorkout({ ...plan, sessions: plan.sessions.map(s =>
                            s.id === session.id ? { ...s, skipped: false } : s) }, session.id, dates[session.id] ?? session.date, runs),
                          progress.status === 'skipped' ? 'Session restored.' : 'Session moved.')}>{progress.status === 'skipped' ? 'Restore on this date' : 'Move session'}</button>
                        {progress.status === 'pending' && <><button className="btn small" disabled={busy} onClick={() =>
                          void persist(() => ({ ...plan, sessions: plan.sessions.map(s => s.id === session.id
                            ? { ...s, phases: s.phases.map(p => p.kind === 'run' ? { ...p, seconds: Math.max(30, Math.round(p.seconds / 2)) } : p) } : s) }),
                          'Running blocks reduced. Walk whenever you need to.')}>Reduce running blocks</button>
                        <button className="btn small ghost" disabled={busy} onClick={() =>
                          void persist(() => ({ ...plan, sessions: plan.sessions.map(s => s.id === session.id ? { ...s, skipped: true } : s) }), 'Session skipped. No catch-up needed.')}>Skip session</button></>}
                      </div>
                    </details>}
                  </li>;
                })}
              </ul>
            </details>;
          })}
        </>
      )}
    </>
  );
}
