import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { RouteReplay } from '../components/RouteMap';
import { Bar, ClassChip, Stat } from '../components/ui';
import { db } from '../data/db';
import { CLASSES, CLASS_IDS } from '../game/classes';
import { reportForRun } from '../game/engine';
import { runClass, type ClassId, type TrackPoint } from '../game/types';
import { BOSSES } from '../game/world';
import { formatDateTime, formatDistance, formatDuration, formatPace } from '../lib/format';
import { useGame } from '../state/GameContext';
import { workoutProgress } from '../training/plans';

export function RunDetailPage() {
  const { id = '' } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { runs, game, profile, redemptions, saveRun, deleteRun, trainingPlan } = useGame();
  const run = runs.find((r) => r.id === id);
  const [points, setPoints] = useState<TrackPoint[] | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const isNew = params.get('new') === '1';

  useEffect(() => {
    void db.points(id).then(setPoints);
  }, [id]);

  const report = useMemo(() => (isNew && run ? reportForRun(runs, id, redemptions) : null), [isNew, run, runs, id, redemptions]);

  if (!run) {
    return (
      <section className="panel center">
        <p>This run could not be found.</p>
        <Link to="/runs" className="btn">
          Back to log
        </Link>
      </section>
    );
  }

  const res = game.runResults[run.id];
  const cls = runClass(run);
  const maxSplit = Math.max(...run.splits, 1);
  const minSplit = Math.min(...run.splits);
  const attemptBoss = res?.bossAttempt ? BOSSES.find((b) => b.id === res.bossAttempt!.bossId) : undefined;

  const setClass = async (c: ClassId) => {
    await saveRun({ ...run, classOverride: c === run.autoClass ? undefined : c });
  };

  const remove = async () => {
    await deleteRun(run.id);
    navigate('/runs', { replace: true });
  };

  return (
    <>
      {run.training && <section className="panel">
        <h2>{run.training.completed ? 'Planned session complete' : 'Partial workout saved'}</h2>
        <p className="small">{run.training.completed ? 'You completed your planned session at your own pace. Walking counts.'
          : 'This attempt stays in your journal. Adjust the schedule when ready; there is no catch-up debt.'}</p>
        {trainingPlan && (() => {
          const session = trainingPlan.sessions.find(s => s.id === run.training?.sessionId);
          if (!session) return null;
          const week = trainingPlan.sessions.filter(s => s.week === session.week);
          const completed = week.filter(s => workoutProgress(s, runs).status === 'completed').length;
          return <p className="small">Week {session.week} · {completed} / 3 planned sessions completed.
            {completed === 3 && ' Training milestone reached!'}</p>;
        })()}
        <Link to="/training" className="btn">Back to training journal</Link>
      </section>}
      {report && (
        <section className="panel victory">
          <div className="burst">{report.bossDefeated ? report.bossDefeated.icon : report.levelAfter > report.levelBefore ? '⭐' : '🏆'}</div>
          <h1 style={{ color: 'var(--gold)' }}>{run.training ? 'Run saved!' : report.bossDefeated ? `${report.bossDefeated.name} defeated!` : 'Quest complete!'}</h1>
          <div className="grid-2" style={{ marginBottom: 10 }}>
            <Stat label="XP" value={`+${report.xpGained}`} />
            <Stat label="Gold" value={`+${report.goldGained}`} />
          </div>
          {report.levelAfter > report.levelBefore && (
            <p className="pixel tiny" style={{ color: 'var(--gold)' }}>
              ⬆ LEVEL UP! {report.levelBefore} → {report.levelAfter}
            </p>
          )}
          {report.classLevelAfter > report.classLevelBefore && (
            <p className="small">
              {CLASSES[report.result.cls].icon} {CLASSES[report.result.cls].name} reached level {report.classLevelAfter}!
            </p>
          )}
          {report.regionReached && (
            <p className="small">
              {report.regionReached.icon} You entered <b>{report.regionReached.name}</b>!
            </p>
          )}
          {report.questsCompleted > 0 && <p className="small">📜 {report.questsCompleted} quest(s) completed (+{report.questXp} XP)</p>}
          {report.newRecords.map((r) => (
            <p key={r} className="small">
              🏅 New record: {r}
            </p>
          ))}
          {report.newAchievements.map((a) => (
            <p key={a.id} className="small">
              {a.icon} Badge unlocked: <b>{a.name}</b> (+{a.gold} gold)
            </p>
          ))}
          {!run.training && !report.bossDefeated && attemptBoss && res.bossAttempt && (
            <p className="small">
              {attemptBoss.icon} You hit the {attemptBoss.name} for {Math.round(res.bossAttempt.progress * 100)}% of its HP, but it still stands.
            </p>
          )}
          {res.fatigueMultiplier < 1 && <p className="small muted">😮‍💨 Your hero is tired this week: XP reduced. Rest up!</p>}
          <Link to="/" className="btn gold-btn">
            Continue
          </Link>
        </section>
      )}

      <h1>{formatDateTime(run.startedAt)}</h1>
      <div className="grid-3" style={{ marginBottom: 14 }}>
        <Stat label="Distance" value={formatDistance(run.distanceM, profile.units)} />
        <Stat label="Time" value={formatDuration(run.durationSec)} />
        <Stat label="Pace" value={formatPace(run.distanceM, run.durationSec, profile.units).replace(/ \/.*/, '')} />
      </div>

      <section className="panel">
        <div className="row between">
          <h2>Class</h2>
          <ClassChip id={cls} overridden={!!run.classOverride} />
        </div>
        <p className="small muted" style={{ marginTop: 0 }}>
          Judged as {CLASSES[run.autoClass].icon} {CLASSES[run.autoClass].name}. Tap to change.
        </p>
        <div className="segmented">
          {CLASS_IDS.map((c) => (
            <button key={c} aria-pressed={cls === c} className={cls === c ? 'on' : ''} onClick={() => setClass(c)}>
              {CLASSES[c].icon} {CLASSES[c].name}
            </button>
          ))}
        </div>
      </section>

      {res && (
        <section className="panel">
          <h2>{run.training ? 'Prototype XP and rewards' : 'Rewards'}</h2>
          {run.training && <p className="small muted">These original game calculations are separate from training completion. Extra distance is not required.</p>}
          <ul className="list small">
            <li>
              <span className="grow">Distance & time</span>
              <span>{res.baseXp} XP</span>
            </li>
            {res.bonusXp > 0 && (
              <li>
                <span className="grow">{res.bonusReason}</span>
                <span>+{res.bonusXp} XP</span>
              </li>
            )}
            {res.fatigueMultiplier < 1 && (
              <li>
                <span className="grow">Weekly fatigue</span>
                <span>×{res.fatigueMultiplier.toFixed(2)}</span>
              </li>
            )}
            <li>
              <b className="grow">Run total</b>
              <b>
                {res.xp} XP · 🪙 {res.gold}
              </b>
            </li>
            {res.bossDefeated && (
              <li>
                <span className="grow">⚔️ Boss defeated: {BOSSES.find((b) => b.id === res.bossDefeated)?.name}</span>
              </li>
            )}
            <li>
              <span className="grow">🗺️ Map travel</span>
              <span>{res.mapKm.toFixed(2)} km</span>
            </li>
          </ul>
        </section>
      )}

      {run.splits.length > 0 && (
        <section className="panel">
          <h2>Splits{run.source === 'manual' && ' (estimated)'}</h2>
          <table className="splits">
            <tbody>
              {run.splits.map((s, i) => (
                <tr key={i}>
                  <td style={{ width: 50 }}>km {i + 1}</td>
                  <td style={{ width: 60 }}>{formatDuration(s)}</td>
                  <td>
                    <div
                      className="split-bar"
                      style={{ width: `${(s / maxSplit) * 100}%`, background: s === minSplit && run.splits.length > 1 ? 'var(--gold)' : undefined }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {run.source === 'gps' && (
        <section className="panel">
          <h2>Route replay</h2>
          {points ? <RouteReplay points={points} /> : <p className="small muted">Loading route…</p>}
        </section>
      )}

      <section className="panel">
        <h2>Details</h2>
        <ul className="list small">
          <li>
            <span className="grow">Elevation gain</span>
            <span>{run.elevationGainM} m</span>
          </li>
          {run.paceVariability !== null && (
            <li>
              <span className="grow">Pace variation</span>
              <span style={{ width: 120 }}>
                <Bar value={run.paceVariability} max={0.4} />
              </span>
            </li>
          )}
          <li>
            <span className="grow">Source</span>
            <span>{run.source === 'gps' ? '📡 GPS' : '✍️ Manual'}</span>
          </li>
          {run.notes && (
            <li>
              <span className="grow">{run.notes}</span>
            </li>
          )}
        </ul>
      </section>

      {confirmDelete ? (
        <section className="panel">
          <h2>Delete this run?</h2>
          <p className="small">XP, gold, map progress and badges are recalculated without it.</p>
          <div className="grid-2">
            <button className="btn danger" onClick={remove}>
              Delete
            </button>
            <button className="btn" onClick={() => setConfirmDelete(false)}>
              Cancel
            </button>
          </div>
        </section>
      ) : (
        <button className="btn ghost block" onClick={() => setConfirmDelete(true)}>
          🗑 Delete run
        </button>
      )}
    </>
  );
}
