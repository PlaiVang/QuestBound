import { Link } from 'react-router-dom';
import { CLASSES } from '../game/classes';
import { runClass } from '../game/types';
import { formatDate, formatDistance, formatDuration, formatPace } from '../lib/format';
import { startOfWeek } from '../lib/dates';
import { useGame } from '../state/GameContext';
import { RunRouteThumbnail } from '../components/RunRouteThumbnail';

export function HistoryPage() {
  const { runs, game, profile } = useGame();
  const sorted = runs.slice().sort((a, b) => b.startedAt - a.startedAt);
  const weeks = new Map<number, typeof sorted>();
  for (const r of sorted) {
    const w = startOfWeek(r.startedAt);
    weeks.set(w, [...(weeks.get(w) ?? []), r]);
  }

  return (
    <>
      <div className="row between">
        <h1>Adventure log</h1>
        <Link to="/run/manual" className="btn ghost">
          ＋ Log
        </Link>
      </div>
      <div className="grid-3" style={{ marginBottom: 14 }}>
        <div className="stat-box">
          <div className="label">Runs</div>
          <div className="value">{game.totals.runs}</div>
        </div>
        <div className="stat-box">
          <div className="label">Distance</div>
          <div className="value">{formatDistance(game.totals.distanceM, profile.units, 0)}</div>
        </div>
        <div className="stat-box">
          <div className="label">Time</div>
          <div className="value">{Math.round(game.totals.durationSec / 3600)}h</div>
        </div>
      </div>
      {sorted.length === 0 && (
        <section className="panel center">
          <p>No runs yet. Your log fills up as you adventure.</p>
          <Link to="/run" className="btn primary">
            🏃 Start a run
          </Link>
        </section>
      )}
      {[...weeks.entries()].map(([week, list]) => (
        <section key={week} className="panel">
          <div className="row between">
            <h2>Week of {formatDate(week)}</h2>
            <span className="small muted">{formatDistance(list.reduce((a, r) => a + r.distanceM, 0), profile.units, 1)}</span>
          </div>
          <div className="list">
            {list.map((r) => {
              const cls = CLASSES[runClass(r)];
              const res = game.runResults[r.id];
              return (
                <Link key={r.id} to={`/runs/${r.id}`}>
                  <RunRouteThumbnail run={r} icon={cls.icon} />
                  <div className="grow">
                    <div>
                      {formatDistance(r.distanceM, profile.units)} <span className="muted small">· {formatDuration(r.durationSec)}</span>
                    </div>
                    <div className="small muted">
                      {formatDate(r.startedAt)} · {formatPace(r.distanceM, r.durationSec, profile.units)}
                      {r.source === 'manual' && ' · ✍️'}
                      {res?.bossDefeated && ' · ⚔️'}
                    </div>
                  </div>
                  <span className="small">+{res?.xp ?? 0} XP</span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
