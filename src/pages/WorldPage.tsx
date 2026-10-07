import { Bar } from '../components/ui';
import { REGIONS } from '../game/world';
import { formatDistance } from '../lib/format';
import { useGame } from '../state/GameContext';

const SCENERY: [string, number, number][] = [
  ['🌲', 26, 70], ['🌲', 44, 72], ['🌳', 30, 90], ['🌲', 50, 92], ['🌾', 70, 93], ['🪨', 90, 82],
  ['⛰️', 92, 58], ['⛰️', 78, 62], ['🔥', 52, 50], ['🌋', 76, 46], ['🧊', 24, 56], ['🌊', 46, 40],
  ['🦇', 6, 26], ['🌑', 24, 26], ['☁️', 56, 10], ['☁️', 88, 22], ['🦴', 52, 28], ['🌙', 92, 4],
];

function heroPosition(km: number): [number, number] {
  for (let i = 0; i < REGIONS.length - 1; i++) {
    const a = REGIONS[i];
    const b = REGIONS[i + 1];
    if (km < b.atKm) {
      const f = (km - a.atKm) / (b.atKm - a.atKm);
      return [a.x + (b.x - a.x) * f, a.y + (b.y - a.y) * f];
    }
  }
  const last = REGIONS[REGIONS.length - 1];
  return [last.x, last.y];
}

export function WorldPage() {
  const { game, profile } = useGame();
  const { world } = game;
  const [hx, hy] = heroPosition(world.positionKm);
  const statusOf = (regionId: string) => {
    const b = world.bosses.find((s) => s.region.id === regionId);
    if (!b) return 'start';
    return b.status;
  };
  const active = world.bosses.find((b) => b.status === 'active');
  const atGate = active && world.positionKm >= active.region.atKm;
  const path = REGIONS.map((r, i) => `${i ? 'L' : 'M'}${r.x},${r.y}`).join(' ');

  return (
    <>
      <h1>The Realm</h1>
      <p className="small muted">Original distance-based prototype. These optional bosses do not control training-plan completion. Your schedule and recovery come first.</p>
      <svg className="world-svg" viewBox="0 0 100 100" role="img" aria-label="World map">
        <defs>
          <radialGradient id="land" cx="50%" cy="60%" r="75%">
            <stop offset="0%" stopColor="#5d8f4e" />
            <stop offset="60%" stopColor="#3f6b3a" />
            <stop offset="100%" stopColor="#243f2a" />
          </radialGradient>
        </defs>
        <rect width="100" height="100" fill="url(#land)" />
        <rect y="0" width="100" height="32" fill="#2a2440" opacity="0.55" />
        {SCENERY.map(([e, x, y], i) => (
          <text key={i} x={x} y={y} fontSize="5" textAnchor="middle" opacity="0.75">
            {e}
          </text>
        ))}
        <path d={path} fill="none" stroke="#0d0914" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        <path d={path} fill="none" stroke="#e8d3a2" strokeWidth="1.4" strokeDasharray="2 1.5" strokeLinecap="round" strokeLinejoin="round" />
        {REGIONS.map((r) => {
          const s = statusOf(r.id);
          const fill = s === 'defeated' || s === 'start' ? '#ffcc33' : s === 'active' ? '#e53935' : '#6b6b7b';
          return (
            <g key={r.id}>
              <circle cx={r.x} cy={r.y} r="4.2" fill={fill} stroke="#0d0914" strokeWidth="1" />
              <text x={r.x} y={r.y + 1.6} fontSize="4.4" textAnchor="middle">
                {s === 'locked' ? '❔' : s === 'active' ? r.boss!.icon : r.icon}
              </text>
              <text x={r.x} y={r.y + 8} fontSize="2.6" textAnchor="middle" fill="#fff" stroke="#0d0914" strokeWidth="0.5" paintOrder="stroke" fontFamily="var(--pixel)">
                {r.name}
              </text>
            </g>
          );
        })}
        <g style={{ transition: 'transform 1s ease' }} transform={`translate(${hx} ${hy - 6.5})`}>
          <circle r="3.4" fill="#4fc3f7" stroke="#0d0914" strokeWidth="0.8" />
          <text y="1.4" fontSize="4" textAnchor="middle">
            🧙
          </text>
        </g>
      </svg>

      <section className="panel" style={{ marginTop: 14 }}>
        <div className="row">
          <div className="icon-lg">{world.currentRegion.icon}</div>
          <div className="grow">
            <h2 style={{ marginBottom: 4 }}>{world.currentRegion.name}</h2>
            <div className="small muted">{world.currentRegion.lore}</div>
          </div>
        </div>
        <div className="small" style={{ marginTop: 10 }}>
          🧭 Journey: {formatDistance(world.positionKm * 1000, profile.units, 1)}
          {world.nextRegion && ` · next stop ${world.nextRegion.name} at ${formatDistance(world.nextRegion.atKm * 1000, profile.units, 0)}`}
        </div>
        {atGate && (
          <p className="small" style={{ color: 'var(--accent)' }}>
            ⚔️ The {active.boss.name} blocks the road! Distance won't move you forward until you defeat it. Every run still earns XP and gold.
          </p>
        )}
      </section>

      <section className="panel">
        <h2>Bosses</h2>
        <ul className="list">
          {world.bosses.map((b) => (
            <li key={b.boss.id} style={{ opacity: b.status === 'locked' ? 0.55 : 1 }}>
              <div className="icon-lg">{b.status === 'locked' ? '❔' : b.boss.icon}</div>
              <div className="grow">
                <div className="row between">
                  <span className="pixel tiny">{b.status === 'locked' ? '???' : b.boss.name}</span>
                  <span className="tiny muted">{b.region.name}</span>
                </div>
                <div className="small muted" style={{ margin: '4px 0' }}>
                  {b.boss.goalText} · +{b.boss.xp} XP · 🪙 {b.boss.gold}
                </div>
                {b.status === 'defeated' ? (
                  <span className="small" style={{ color: 'var(--good)' }}>
                    ✓ Defeated
                  </span>
                ) : (
                  <Bar value={b.hpPercent} max={100} color="var(--hp)" label={`HP ${b.hpPercent}%`} />
                )}
                {b.status === 'active' && <div className="tiny muted" style={{ marginTop: 4 }}>“{b.boss.taunt}”</div>}
              </div>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}
