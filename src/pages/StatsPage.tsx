import { Link } from 'react-router-dom';
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CLASSES, CLASS_IDS } from '../game/classes';
import { runClass } from '../game/types';
import { addDays, startOfWeek, weekKey } from '../lib/dates';
import { formatDistance, formatDuration, unitMeters } from '../lib/format';
import { useGame } from '../state/GameContext';

const tooltipStyle = {
  contentStyle: { background: '#261c36', border: '2px solid #0d0914', borderRadius: 4 },
  labelStyle: { color: '#f3ead7' },
};

export function StatsPage() {
  const { runs, game, profile } = useGame();
  const u = unitMeters(profile.units);
  const thisWeek = startOfWeek(Date.now());

  const weekly = Array.from({ length: 12 }, (_, i) => {
    const w = addDays(thisWeek, -7 * (11 - i));
    const key = weekKey(w);
    const dist = runs.filter((r) => weekKey(r.startedAt) === key).reduce((a, r) => a + r.distanceM, 0);
    const d = new Date(w);
    return { week: `${d.getMonth() + 1}/${d.getDate()}`, distance: +(dist / u).toFixed(1) };
  });

  const paceTrend = runs
    .slice()
    .sort((a, b) => a.startedAt - b.startedAt)
    .slice(-20)
    .filter((r) => r.distanceM > 0)
    .map((r) => {
      const d = new Date(r.startedAt);
      return {
        date: `${d.getMonth() + 1}/${d.getDate()}`,
        pace: Math.round((r.durationSec * u) / r.distanceM),
        fill: CLASSES[runClass(r)].color,
      };
    });

  const byClass = CLASS_IDS.map((id) => ({
    name: CLASSES[id].name,
    distance: +(runs.filter((r) => runClass(r) === id).reduce((a, r) => a + r.distanceM, 0) / u).toFixed(1),
    color: CLASSES[id].color,
  }));

  return (
    <>
      <h1>Hall of records</h1>
      <section className="panel">
        <h2>Personal records</h2>
        {game.prs.length === 0 && <p className="small muted">Run to set your first records.</p>}
        <div className="list">
          {game.prs.map((p) => (
            <Link key={p.label} to={`/runs/${p.runId}`}>
              <span className="icon-lg">🏅</span>
              <span className="grow">{p.label}</span>
              <span className="pixel tiny">
                {p.kind === 'time' ? formatDuration(p.value) : p.kind === 'distance' ? formatDistance(p.value, profile.units) : `${p.value} m`}
              </span>
            </Link>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>Weekly distance ({profile.units})</h2>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={weekly} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
            <CartesianGrid stroke="#3a2d52" vertical={false} />
            <XAxis dataKey="week" interval={1} />
            <YAxis allowDecimals={false} />
            <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
            <Bar dataKey="distance" fill="#4fc3f7" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="panel">
        <h2>Pace trend (min/{profile.units})</h2>
        {paceTrend.length < 2 ? (
          <p className="small muted">Log at least two runs to see your pace trend.</p>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={paceTrend} margin={{ top: 5, right: 5, left: -10, bottom: 0 }}>
              <CartesianGrid stroke="#3a2d52" vertical={false} />
              <XAxis dataKey="date" />
              <YAxis reversed domain={['dataMin - 15', 'dataMax + 15']} tickFormatter={(v: number) => formatDuration(v)} />
              <Tooltip {...tooltipStyle} formatter={(v) => [formatDuration(Number(v)), 'Pace']} />
              <Line type="monotone" dataKey="pace" stroke="#ff8a3d" strokeWidth={3} dot={{ r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        )}
        <p className="tiny muted">Higher on the chart = faster.</p>
      </section>

      <section className="panel">
        <h2>Distance by class</h2>
        <ResponsiveContainer width="100%" height={160}>
          <BarChart data={byClass} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="name" width={80} />
            <Tooltip {...tooltipStyle} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
            <Bar dataKey="distance" radius={[0, 3, 3, 0]}>
              {byClass.map((c) => (
                <Cell key={c.name} fill={c.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className="panel">
        <h2>Lifetime</h2>
        <ul className="list small">
          <li>
            <span className="grow">Total distance</span>
            <span>{formatDistance(game.totals.distanceM, profile.units, 1)}</span>
          </li>
          <li>
            <span className="grow">Total time</span>
            <span>{formatDuration(game.totals.durationSec)}</span>
          </li>
          <li>
            <span className="grow">Total XP</span>
            <span>{game.totalXp.toLocaleString()}</span>
          </li>
          <li>
            <span className="grow">Gold earned / spent</span>
            <span>
              {game.gold.earned} / {game.gold.spent}
            </span>
          </li>
          <li>
            <span className="grow">Best streak</span>
            <span>{game.streak.best} weeks</span>
          </li>
        </ul>
      </section>
    </>
  );
}
