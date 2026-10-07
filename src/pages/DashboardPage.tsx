import { Link } from 'react-router-dom';
import { Bar, Gold, Stat } from '../components/ui';
import { CLASSES, CLASS_IDS } from '../game/classes';
import type { ClassId } from '../game/types';
import { formatDate, formatDistance, formatPace } from '../lib/format';
import { useGame } from '../state/GameContext';
import { runClass } from '../game/types';
import { planName, workoutProgress } from '../training/plans';

const AVATARS: Record<ClassId, string> = { ranger: '🧝', rogue: '🥷', paladin: '🤴', berserker: '🧔' };

export function questProgressText(progress: number, target: number, unit: string) {
  if (unit === 'done') return progress >= target ? 'Done!' : 'Not yet';
  const p = unit === 'km' ? progress.toFixed(1) : Math.floor(progress);
  return `${p} / ${target} ${unit}`;
}

export function DashboardPage() {
  const { game, runs, profile, trainingPlan } = useGame();
  const completed = trainingPlan?.sessions.filter(s => workoutProgress(s, runs).status === 'completed').length ?? 0;
  const main = CLASS_IDS.reduce((a, b) => (game.classes[b].xp > game.classes[a].xp ? b : a), 'paladin' as ClassId);
  const avatar = runs.length ? AVATARS[main] : '🧙';
  const activeBoss = game.world.bosses.find((b) => b.status === 'active');
  const recent = runs.slice().sort((a, b) => b.startedAt - a.startedAt).slice(0, 3);
  const maxStat = Math.max(20, ...game.stats.map((s) => s.value));
  const energyPct = game.thisWeek.km / game.thisWeek.capKm;

  return (
    <>
      <section className="panel">
        <div className="row">
          <div className="avatar">{avatar}</div>
          <div className="grow">
            <h1 style={{ marginBottom: 4 }}>{profile.heroName}</h1>
            <div className="muted small" style={{ marginBottom: 8 }}>
              Lv {game.level} {game.title}
              {runs.length > 0 && ` · ${CLASSES[main].name}`}
            </div>
            <Bar value={game.levelCurrent} max={game.levelNeeded} label={`${game.levelCurrent} / ${game.levelNeeded} XP`} />
          </div>
        </div>
        <div className="grid-3" style={{ marginTop: 12 }}>
          <Stat label="Gold" value={<Gold amount={game.gold.balance} />} />
          <Stat label="Streak" value={`🔥 ${game.streak.weeks}w`} />
          <Stat label="Runs" value={game.totals.runs} />
        </div>
      </section>

      <section className="panel">
        <h2>{trainingPlan ? planName(trainingPlan.goal) : 'Your training comes first'}</h2>
        <p className="small">{trainingPlan ? `${completed} planned sessions completed. Rest days and forgiving restarts are part of the journey.`
          : 'Choose three training days and preview your workouts before starting. Build a routine or take a walk/run path toward your first 5K.'}</p>
        <Link to="/training" className="btn primary block">{trainingPlan ? 'Open training journal' : 'Preview a training plan'}</Link>
      </section>

      {runs.length === 0 && !trainingPlan && (
        <section className="panel center">
          <h2>Your quest begins</h2>
          <p className="small">You can also log runs without a plan. The original distance-based Realm and rewards remain available while the training adventure is developed.</p>
          <Link to="/run" className="btn primary big block">
            🏃 Start your first run
          </Link>
        </section>
      )}

      <section className="panel">
        <div className="row between">
          <h2>This week</h2>
          <span className="small muted">{game.streak.thisWeekRuns} / 2 runs for streak</span>
        </div>
        <div className="small" style={{ marginBottom: 6 }}>
          {formatDistance(game.thisWeek.km * 1000, profile.units, 1)} of {formatDistance(game.thisWeek.capKm * 1000, profile.units, 0)} full-XP limit
        </div>
        <Bar
          value={game.thisWeek.km}
          max={game.thisWeek.capKm}
          color={energyPct >= 1 ? 'var(--hp)' : energyPct > 0.8 ? 'var(--accent)' : 'var(--good)'}
        />
        {energyPct >= 1 && <p className="small muted">Your hero is tired. Extra distance earns reduced XP this week. Rest is part of training!</p>}
      </section>

      <section className="panel">
        <h2>Hero stats</h2>
        {game.stats.map((s) => (
          <div key={s.name} style={{ marginBottom: 10 }}>
            <div className="row between small">
              <span>
                {CLASSES[s.classId].icon} {s.name}
              </span>
              <span className="pixel tiny">{s.value}</span>
            </div>
            <Bar value={s.value} max={maxStat} color={CLASSES[s.classId].color} />
          </div>
        ))}
        <div className="row wrap" style={{ marginTop: 6 }}>
          {CLASS_IDS.map((id) => (
            <span key={id} className="chip">
              {CLASSES[id].icon} {CLASSES[id].name} Lv {game.classes[id].level}
            </span>
          ))}
        </div>
      </section>

      {!trainingPlan && activeBoss && (
        <Link to="/world" className="panel" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
          <h2>Realm boss (distance prototype)</h2>
          <div className="row">
            <div className="icon-lg">{activeBoss.boss.icon}</div>
            <div className="grow">
              <div className="pixel tiny">{activeBoss.boss.name}</div>
              <div className="small muted" style={{ margin: '4px 0' }}>
                {activeBoss.boss.goalText} · {activeBoss.region.name}
              </div>
              <Bar value={activeBoss.hpPercent} max={100} color="var(--hp)" label={`HP ${activeBoss.hpPercent}%`} />
            </div>
          </div>
          <div className="small muted" style={{ marginTop: 8 }}>
            {game.world.positionKm >= activeBoss.region.atKm
              ? '⚔️ The boss blocks your path. Fight it on your next run!'
              : `${formatDistance((activeBoss.region.atKm - game.world.positionKm) * 1000, profile.units, 1)} until you reach it`}
          </div>
        </Link>
      )}

      {!trainingPlan && <Link to="/quests" className="panel" style={{ display: 'block', color: 'inherit', textDecoration: 'none' }}>
        <h2>Today's quest</h2>
        <div className="row">
          <div className="icon-lg">{game.quests.daily.quest.icon}</div>
          <div className="grow">
            <div className="pixel tiny">{game.quests.daily.quest.name}</div>
            <div className="small muted" style={{ margin: '4px 0' }}>
              {game.quests.daily.quest.description}
            </div>
            <Bar
              value={game.quests.daily.progress}
              max={game.quests.daily.quest.target}
              color={game.quests.daily.complete ? 'var(--good)' : undefined}
              label={questProgressText(game.quests.daily.progress, game.quests.daily.quest.target, game.quests.daily.quest.unit)}
            />
          </div>
        </div>
      </Link>}

      {recent.length > 0 && (
        <section className="panel">
          <div className="row between">
            <h2>Recent runs</h2>
            <Link to="/runs" className="small">
              All →
            </Link>
          </div>
          <div className="list">
            {recent.map((r) => (
              <Link key={r.id} to={`/runs/${r.id}`}>
                <div className="icon-lg">{CLASSES[runClass(r)].icon}</div>
                <div className="grow">
                  <div>{formatDistance(r.distanceM, profile.units)}</div>
                  <div className="small muted">
                    {formatDate(r.startedAt)} · {formatPace(r.distanceM, r.durationSec, profile.units)}
                  </div>
                </div>
                <span className="small">+{game.runResults[r.id]?.xp ?? 0} XP</span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <div className="grid-3">
        <Link to="/stats" className="btn">
          📊 Stats
        </Link>
        <Link to="/rewards" className="btn">
          🎁 Shop
        </Link>
        <Link to="/settings" className="btn">
          ⚙️ Setup
        </Link>
      </div>
    </>
  );
}
