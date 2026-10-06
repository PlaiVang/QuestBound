import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
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
  const { profile, runs, saveRun } = useGame();
  const navigate = useNavigate();
  const [chosen, setChosen] = useState<ClassId | 'auto'>(() => (localStorage.getItem(CLASS_KEY) as ClassId | null) ?? 'auto');
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'finish' | 'discard' | null>(null);
  const active = session.status !== 'idle';
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
    try {
      await runSession.start();
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      const { startedAt, movingSec, points } = await runSession.finish();
      const run = runFromTrack(points, startedAt, movingSec, runs, chosen === 'auto' ? undefined : chosen);
      await saveRun(run, points);
      pickClass('auto');
      navigate(`/runs/${run.id}?new=1`, { replace: true });
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const discard = async () => {
    await runSession.discard();
    setConfirm(null);
  };

  const movingSec = runSession.movingMs() / 1000;
  const cur = currentPace(session.points);

  if (!active) {
    return (
      <>
        <h1>Prepare for battle</h1>
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
        <button className="btn primary big block" onClick={start} disabled={busy}>
          ▶ Start run
        </button>
        <p className="small muted center">
          GPS keeps tracking with the screen off. A notification shows while you run.
        </p>
        <div className="center">
          <Link to="/run/manual" className="btn ghost">
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
          <button className="btn danger big" onClick={() => setConfirm(session.distanceM < MIN_SAVE_M ? 'discard' : 'finish')}>
            ■ Finish
          </button>
        </div>
      )}

      {confirm === 'finish' && (
        <section className="panel" style={{ marginTop: 14 }}>
          <h2>End this quest?</h2>
          <div className="grid-3">
            <button className="btn good" onClick={finish} disabled={busy}>
              ✓ Save
            </button>
            <button className="btn" onClick={() => setConfirm(null)}>
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
            <button className="btn danger" onClick={discard}>
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
