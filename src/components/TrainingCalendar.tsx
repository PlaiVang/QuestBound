import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { Run } from '../game/types';
import { dayKey } from '../lib/dates';
import { formatDuration } from '../lib/format';
import { dateMs, workoutProgress, workoutSeconds, type TrainingPlan } from '../training/plans';

export function TrainingCalendar({ plan, runs, busy, onStart }: {
  plan: TrainingPlan | null; runs: Run[]; busy: boolean; onStart: (id: string) => void;
}) {
  const [selected, setSelected] = useState(() => dayKey(Date.now()));
  const [today, setToday] = useState(() => dayKey(Date.now()));
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const offset = (month.getDay() + 6) % 7;
  const length = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const cells = Math.ceil((offset + length) / 7) * 7;
  const sessions = plan?.sessions.filter(s => s.date === selected) ?? [];
  const logs = runs.filter(r => dayKey(r.startedAt) === selected);
  const moveMonth = (delta: number) => {
    const next = new Date(month.getFullYear(), month.getMonth() + delta, 1);
    setMonth(next);
    setSelected(dayKey(next.getTime()));
  };
  return <section className="panel">
    <h2>Training calendar</h2>
    <div className="row between calendar-heading">
      <button className="btn small" aria-label="Previous month" onClick={() => moveMonth(-1)}>←</button>
      <span className="small" aria-live="polite">{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
      <button className="btn small" aria-label="Next month" onClick={() => moveMonth(1)}>→</button>
    </div>
    <div className="calendar-grid">
      {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => <span key={day} className="calendar-weekday">{day}</span>)}
      {Array.from({ length: cells }, (_, i) => {
        const number = i - offset + 1;
        if (number < 1 || number > length) return <span key={i} />;
        const key = dayKey(new Date(month.getFullYear(), month.getMonth(), number).getTime());
        const scheduled = plan?.sessions.filter(s => s.date === key) ?? [];
        const dayRuns = runs.filter(r => dayKey(r.startedAt) === key);
        const completed = scheduled.some(s => workoutProgress(s, runs).status === 'completed');
        const pending = scheduled.some(s => workoutProgress(s, runs).status === 'pending');
        const skipped = scheduled.some(s => workoutProgress(s, runs).status === 'skipped');
        return <button key={i} className={`calendar-day${key === selected ? ' selected' : ''}`}
          aria-pressed={key === selected} aria-current={key === today ? 'date' : undefined}
          aria-label={`${new Date(dateMs(key)).toLocaleDateString(undefined, { dateStyle: 'full' })}${pending ? ', planned workout' : ''}${completed ? ', completed workout' : ''}${skipped ? ', skipped workout' : ''}${dayRuns.length ? `, ${dayRuns.length} logged runs` : ''}`}
          onClick={() => setSelected(key)}>
          <span>{number}</span>
          <span className="calendar-markers" aria-hidden="true">{completed ? '✓' : pending ? '●' : skipped ? '–' : ''}{dayRuns.length > 0 ? '▣' : ''}</span>
        </button>;
      })}
    </div>
    <p className="tiny muted">● Planned · ✓ Completed · – Skipped · ▣ Logged run</p>
    <button className="btn small ghost" onClick={() => {
      const now = new Date();
      setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
      setToday(dayKey(now.getTime()));
      setSelected(dayKey(now.getTime()));
    }}>Today</button>
    <h3 className="calendar-selected">{new Date(dateMs(selected)).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}</h3>
    {sessions.map(session => {
      const status = workoutProgress(session, runs).status;
      return <div key={session.id} className="calendar-session">
        <p className="small"><b>{session.title}</b> · {formatDuration(workoutSeconds(session))} · {status}</p>
        {status === 'pending' && <button className="btn small primary" disabled={busy} onClick={() => onStart(session.id)}>
          {session.date <= today ? 'Start run' : 'Move to today & start'}
        </button>}
      </div>;
    })}
    {logs.map(run => <p key={run.id} className="small"><Link to={`/runs/${run.id}`}>View run · {formatDuration(run.durationSec)}</Link></p>)}
    {!sessions.length && !logs.length && <p className="small muted">No workout or run logged for this day. Recovery days belong in your schedule too.</p>}
  </section>;
}
