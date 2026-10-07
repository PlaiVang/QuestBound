import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CLASSES, CLASS_IDS } from '../game/classes';
import { manualRun } from '../game/runFactory';
import type { ClassId } from '../game/types';
import { unitMeters } from '../lib/format';
import { useGame } from '../state/GameContext';
import { eligibleWorkouts, linkWorkout } from '../training/plans';

const toLocalInput = (ms: number) => {
  const d = new Date(ms);
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

export function ManualRunPage() {
  const { profile, runs, saveRun, trainingPlan } = useGame();
  const [params] = useSearchParams();
  const [workoutId, setWorkoutId] = useState(params.get('workout') ?? '');
  const [completed, setCompleted] = useState(false);
  const [busy, setBusy] = useState(false);
  const eligible = eligibleWorkouts(trainingPlan, runs);
  const navigate = useNavigate();
  const [when, setWhen] = useState(() => toLocalInput(Date.now() - 3600_000));
  const [distance, setDistance] = useState('');
  const [h, setH] = useState('0');
  const [m, setM] = useState('');
  const [s, setS] = useState('0');
  const [elev, setElev] = useState('0');
  const [cls, setCls] = useState<ClassId | 'auto'>('auto');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const distanceM = (distance === '' && workoutId ? 0 : parseFloat(distance)) * unitMeters(profile.units);
    const durationSec = (parseInt(h) || 0) * 3600 + (parseInt(m) || 0) * 60 + (parseInt(s) || 0);
    const startedAt = new Date(when).getTime();
    if (!Number.isFinite(distanceM) || (workoutId ? distanceM < 0 : distanceM < 100)) return setError(workoutId ? 'Enter a valid distance, or leave it blank if unknown.' : 'Enter a distance of at least 100 meters in your selected units.');
    if (!Number.isFinite(durationSec) || durationSec < 60) return setError('Enter a duration of at least 1 minute.');
    if (distanceM > 0 && durationSec / (distanceM / 1000) < 120) return setError('That pace is faster than 2:00/km. Please check your numbers.');
    if (!Number.isFinite(startedAt) || startedAt > Date.now()) return setError('Pick a start time in the past.');
    let run = manualRun(
      { startedAt, distanceM: Math.round(distanceM), durationSec, elevationGainM: Math.max(0, parseInt(elev) || 0), notes: notes.trim() || undefined },
      runs,
      cls === 'auto' ? undefined : cls,
    );
    setBusy(true);
    setError(null);
    try {
      if (workoutId) {
        const session = trainingPlan?.sessions.find(s => s.id === workoutId);
        if (!session) throw new Error('Choose an available planned session.');
        run = linkWorkout(run, session, runs, completed);
        if (distanceM === 0) run.notes = [run.notes, 'Distance not recorded.'].filter(Boolean).join(' ');
      }
      await saveRun(run);
      navigate(`/runs/${run.id}?new=1`, { replace: true });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Your run could not be saved. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      <h1>Log a run</h1>
      <section className="panel">
        <label className="field">
          <span>Planned session</span>
          <select value={workoutId} onChange={e => { setWorkoutId(e.target.value); setCompleted(false); }}>
            <option value="">Unplanned run</option>
            {workoutId && !eligible.some(s => s.id === workoutId) && <option value={workoutId}>Session unavailable — choose another</option>}
            {eligible.map(s => <option key={s.id} value={s.id}>Week {s.week} · {s.date} · {s.title}</option>)}
          </select>
        </label>
        {workoutId && <label className="day-choice">
          <input type="checkbox" checked={completed} onChange={e => setCompleted(e.target.checked)} />
          I completed this workout, including prescribed walking.
        </label>}
        {workoutId && <p className="small muted">Leave unchecked for an early stop. Walking counts; no pace target. Unknown distance can be left blank.</p>}
        <label className="field">
          <span>Start time</span>
          <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required />
        </label>
        <label className="field">
          <span>Distance ({profile.units}){workoutId && ' — optional if unknown'}</span>
          <input type="number" inputMode="decimal" step="0.01" min="0" value={distance} onChange={(e) => setDistance(e.target.value)} required={!workoutId} />
        </label>
        <label className="field">
          <span>Duration (h : m : s)</span>
          <div className="row">
            <input type="number" inputMode="numeric" min="0" value={h} onChange={(e) => setH(e.target.value)} aria-label="Hours" />
            <input type="number" inputMode="numeric" min="0" max="59" value={m} onChange={(e) => setM(e.target.value)} aria-label="Minutes" placeholder="min" required />
            <input type="number" inputMode="numeric" min="0" max="59" value={s} onChange={(e) => setS(e.target.value)} aria-label="Seconds" />
          </div>
        </label>
        <label className="field">
          <span>Elevation gain (m)</span>
          <input type="number" inputMode="numeric" min="0" value={elev} onChange={(e) => setElev(e.target.value)} />
        </label>
        <div className="field">
          <label className="field" style={{ marginBottom: 4 }}>
            <span>Class</span>
          </label>
          <div className="segmented">
            <button type="button" aria-pressed={cls === 'auto'} className={cls === 'auto' ? 'on' : ''} onClick={() => setCls('auto')}>
              ✨ Auto
            </button>
            {CLASS_IDS.map((id) => (
              <button type="button" key={id} aria-pressed={cls === id} className={cls === id ? 'on' : ''} onClick={() => setCls(id)}>
                <PixelArt name={id} /> {CLASSES[id].name}
              </button>
            ))}
          </div>
        </div>
        <label className="field" style={{ marginTop: 12 }}>
          <span>Notes</span>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Treadmill, intervals, how it felt…" />
        </label>
      </section>
      {error && <div className="toast" role="alert">{error}</div>}
      <button className="btn primary big block" type="submit" disabled={busy}>
        {busy ? 'Saving...' : '✓ Save run'}
      </button>
    </form>
  );
}
import { PixelArt } from '../components/PixelArt';
