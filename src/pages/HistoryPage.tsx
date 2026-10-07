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
      <div className="history-heading">
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
          <div className="history-week-heading">
            <h2>Week of {formatDate(week)}</h2>
            <span className="small muted">{formatDistance(list.reduce((a, r) => a + r.distanceM, 0), profile.units, 1)}</span>
          </div>
          <div className="list history-runs">
            {list.map((r) => {
              const cls = CLASSES[runClass(r)];
              const res = game.runResults[r.id];
              return (
                <Link key={r.id} to={`/runs/${r.id}`}>
                  <RunRouteThumbnail run={r} icon={cls.icon} />
                  <div className="history-run-details">
                    <div className="history-run-metrics">
                      <strong>{formatDistance(r.distanceM, profile.units)}</strong>
                      <span className="muted small">{formatDuration(r.durationSec)}</span>
                    </div>
                    <div className="history-run-meta small muted">
                      <span>{formatDate(r.startedAt)}</span>
                      <span>{formatPace(r.distanceM, r.durationSec, profile.units)}</span>
                    </div>
                    <div className="history-run-meta small">
                      <span>+{res?.xp ?? 0} XP</span>
                      {r.source === 'manual' && <span className="muted">Manual</span>}
                      {res?.bossDefeated && <span className="muted">Boss defeated</span>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}
