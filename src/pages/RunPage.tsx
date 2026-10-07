import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { RouteMap } from '../components/RouteMap';
import { Stat } from '../components/ui';
import { CLASSES, CLASS_IDS } from '../game/classes';
import { runFromTrack } from '../game/runFactory';
import type { ClassId, TrackPoint } from '../game/types';
import { formatDistance, formatDuration, formatPace } from '../lib/format';
import { haversine } from '../lib/geo';
import { useGame } from '../state/GameContext';
import { runSession } from '../tracking/runSession';
import { useRunSession, useTicker } from '../tracking/useRunSession';
import { WorkoutGuide } from '../components/WorkoutGuide';
import { eligibleWorkouts, linkWorkout, workoutSeconds } from '../training/plans';

const CLASS_KEY = 'questbound:run-class';
const MIN_SAVE_M = 100;

/** Pace over roughly the last 250 m of the current segment. */
function currentPace(points: TrackPoint[]): { meters: number; seconds: number } {
  let meters = 0;
  for (let i = points.length - 1; i > 0; i--) {
    const a = points[i - 1];
    const b = points[i];
    if (a[4] !== b[4]) break;
    meters += haversine(a[0], a[1], b[0], b[1]);
    if (meters >= 250) return { meters, seconds: (points[points.length - 1][2] - a[2]) / 1000 };
  }
  return { meters: 0, seconds: 0 };
}

function SignalIndicator({ accuracy, lastFixAt }: { accuracy: number | null; lastFixAt: number | null }) {
  const stale = !lastFixAt || Date.now() - lastFixAt > 15000;
  let text = '📡 Searching for GPS…';
  let color = 'var(--muted)';
  if (!stale && accuracy !== null) {
    if (accuracy <= 10) [text, color] = ['🟢 GPS strong', 'var(--good)'];
    else if (accuracy <= 25) [text, color] = ['🟡 GPS okay', 'var(--gold)'];
    else [text, color] = ['🔴 GPS weak, waiting for a better signal', 'var(--hp)'];
  }
  return (
    <div className="small center" style={{ color, marginBottom: 10 }}>
      {text}
      {!stale && accuracy !== null && <span className="muted"> (±{Math.round(accuracy)} m)</span>}
    </div>
  );
}

export function RunPage() {
  const session = useRunSession();
  const { profile, runs, saveRun, trainingPlan } = useGame();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [selectedWorkout, setSelectedWorkout] = useState(params.get('workout') ?? '');
  const [completedWorkout, setCompletedWorkout] = useState(false);
  const [saveUnplanned, setSaveUnplanned] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [chosen, setChosen] = useState<ClassId | 'auto'>(() => (localStorage.getItem(CLASS_KEY) as ClassId | null) ?? 'auto');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'finish' | 'discard' | null>(null);
  const active = session.status !== 'idle';
  const eligible = eligibleWorkouts(trainingPlan, runs);
  const workout = trainingPlan?.sessions.find(s => s.id === (active ? session.workoutId : selectedWorkout));
  useTicker(active);

  useEffect(() => {
    void runSession.restore();
  }, []);

  const pickClass = (c: ClassId | 'auto') => {
    setChosen(c);
    if (c === 'auto') localStorage.removeItem(CLASS_KEY);
    else localStorage.setItem(CLASS_KEY, c);
  };

  const start = async () => {
    setBusy(true);
    setSaveError('');
    try {
      if (selectedWorkout && !eligible.some(s => s.id === selectedWorkout)) {
        throw new Error('This session is not available. Choose a due session or move it in your training journal.');
      }
      setCompletedWorkout(false);
      setSaveUnplanned(false);
      await runSession.start(selectedWorkout || null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Unable to start this workout.');
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    setSaveError('');
    try {
      const { id, startedAt, movingSec, points } = await runSession.finish();
      let run = runFromTrack(points, startedAt, movingSec, runs, chosen === 'auto' ? undefined : chosen);
      run.id = id;
      if (session.workoutId && !saveUnplanned) {
        if (!workout) throw new Error('The plan changed during this run. Choose "Save as an unplanned run" to keep your log.');
        run = linkWorkout(run, workout, runs, completedWorkout);
      }
      if (run.distanceM < MIN_SAVE_M) run.notes = 'Distance unavailable or incomplete. Workout time recorded; walking counts.';
      await saveRun(run, points);
      await runSession.discard();
      pickClass('auto');
      navigate(`/runs/${run.id}?new=1`, { replace: true });
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Your run could not be saved. It remains paused; try again.');
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const discard = async () => {
    setBusy(true);
    try {
      await runSession.discard();
      setConfirm(null);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Unable to stop tracking. Try again.');
    } finally {
      setBusy(false);
    }
  };

  const movingSec = runSession.movingMs() / 1000;
  const cur = currentPace(session.points);

  if (!active) {
    return (
      <>
        <h1>Prepare for battle</h1>
        <section className="panel">
          <h2>Planned workout</h2>
          {trainingPlan ? <label className="field">
            <span>Choose a due session, or run without a plan</span>
            <select value={selectedWorkout} onChange={e => setSelectedWorkout(e.target.value)}>
              <option value="">Unplanned run</option>
              {selectedWorkout && !eligible.some(s => s.id === selectedWorkout) && <option value={selectedWorkout}>Session unavailable — choose another</option>}
              {eligible.map(s => <option key={s.id} value={s.id}>Week {s.week} · {s.date} · {s.title}</option>)}
            </select>
          </label> : <p className="small">Preview a schedule before you run. <Link to="/training">Create a training plan</Link></p>}
          {workout && <p className="small">{formatDuration(workoutSeconds(workout))}, including warm-up, any recovery walks, and cooldown. Comfortable effort; no pace target.</p>}
          <Link to="/training" className="small">View or adjust your schedule</Link>
        </section>
        <section className="panel">
          <h2>Today's class</h2>
          <p className="small muted" style={{ marginTop: 0 }}>
            Pick the class that fits today's workout, or let QuestBound decide from your pace and distance. You can change it after the run.
          </p>
          <div className="segmented" style={{ marginBottom: 10 }}>
            <button className={chosen === 'auto' ? 'on' : ''} onClick={() => pickClass('auto')}>
              ✨ Auto
            </button>
            {CLASS_IDS.map((id) => (
              <button key={id} className={chosen === id ? 'on' : ''} onClick={() => pickClass(id)}>
                {CLASSES[id].icon} {CLASSES[id].name}
              </button>
            ))}
          </div>
          <p className="small" style={{ margin: 0 }}>
            {chosen === 'auto' ? (
              'Your run will be judged when you finish.'
            ) : (
              <>
                <b>{CLASSES[chosen].runType}.</b> {CLASSES[chosen].bonusText}.
              </>
            )}
          </p>
        </section>
        {session.error && <div className="toast">{session.error}</div>}
        {saveError && <div className="toast" role="alert">{saveError}</div>}
        <button className="btn primary big block" onClick={start} disabled={busy}>
          ▶ Start run
        </button>
        <p className="small muted center">
          {Capacitor.isNativePlatform() ? 'On Android, the tracking notification keeps GPS active with the screen off.'
            : 'Browser GPS may stop when the screen locks. Keep this screen open, or use the Android app for background tracking.'}
        </p>
        <div className="center">
          <Link to={selectedWorkout ? `/run/manual?workout=${encodeURIComponent(selectedWorkout)}` : '/run/manual'} className="btn ghost">
            ✍️ Log a run manually
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <SignalIndicator accuracy={session.lastAccuracy} lastFixAt={session.lastFixAt} />
      {session.error && <div className="toast">{session.error}</div>}
      {saveError && <div className="toast" role="alert">{saveError}</div>}
      {workout && <WorkoutGuide key={workout.id} workout={workout} elapsedSec={movingSec} running={session.status === 'running'} />}
      <div className="big-number">{formatDuration(movingSec)}</div>
      <div className="grid-3" style={{ marginBottom: 12 }}>
        <Stat label="Distance" value={formatDistance(session.distanceM, profile.units)} />
        <Stat label="Avg pace" value={formatPace(session.distanceM, movingSec, profile.units).replace(/ \/.*/, '')} />
        <Stat label="Now" value={session.status === 'paused' ? '—' : formatPace(cur.meters, cur.seconds, profile.units).replace(/ \/.*/, '')} />
      </div>
      <RouteMap points={session.points} follow />
      {chosen !== 'auto' && (
        <p className="small center">
          Running as {CLASSES[chosen].icon} {CLASSES[chosen].name}
        </p>
      )}

      {confirm === null && (
        <div className="grid-2" style={{ marginTop: 14 }}>
          {session.status === 'running' ? (
            <button className="btn gold-btn big" onClick={() => runSession.pause()}>
              ⏸ Pause
            </button>
          ) : (
            <button className="btn good big" onClick={() => runSession.resume()}>
              ▶ Resume
            </button>
          )}
          <button className="btn danger big" onClick={() => {
            runSession.pause();
            setConfirm(session.distanceM < MIN_SAVE_M && !(session.workoutId && movingSec >= 60) ? 'discard' : 'finish');
          }}>
            ■ Finish
          </button>
        </div>
      )}

      {confirm === 'finish' && (
        <section className="panel" style={{ marginTop: 14 }}>
          <h2>End this quest?</h2>
          {session.workoutId && <label className="day-choice">
            <input type="checkbox" checked={saveUnplanned} onChange={e => setSaveUnplanned(e.target.checked)} />
            Save as an unplanned run instead
          </label>}
          {workout && !saveUnplanned && <>
            <label className="day-choice">
              <input type="checkbox" checked={completedWorkout} onChange={e => setCompletedWorkout(e.target.checked)} />
              I completed this planned workout, including any walking.
            </label>
            <p className="small muted">Leave unchecked to save an early stop. Partial progress stays in your journal; no catch-up exercise is required.</p>
          </>}
          <div className="grid-3">
            <button className="btn good" onClick={finish} disabled={busy}>
              ✓ Save
            </button>
            <button className="btn" onClick={() => { setConfirm(null); runSession.resume(); }}>
              Keep going
            </button>
            <button className="btn danger" onClick={() => setConfirm('discard')}>
              Discard
            </button>
          </div>
        </section>
      )}

      {confirm === 'discard' && (
        <section className="panel" style={{ marginTop: 14 }}>
          <h2>Discard this run?</h2>
          {session.distanceM < MIN_SAVE_M && (
            <p className="small">This run is shorter than {MIN_SAVE_M} m, so it can't be saved.</p>
          )}
          <div className="grid-2">
            <button className="btn danger" onClick={discard} disabled={busy}>
              🗑 Discard
            </button>
            <button className="btn" onClick={() => setConfirm(null)}>
              Keep going
            </button>
          </div>
        </section>
      )}
    </>
  );
}
