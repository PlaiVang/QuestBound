import { Bar } from '../components/ui';
import type { QuestStatus } from '../game/quests';
import { useGame } from '../state/GameContext';
import { questProgressText } from './DashboardPage';

function QuestRow({ s }: { s: QuestStatus }) {
  return (
    <li>
      <div className="icon-lg">{s.complete ? '✅' : s.quest.icon}</div>
      <div className="grow">
        <div className="row between">
          <span className="pixel tiny">{s.quest.name}</span>
          <span className="tiny gold">
            +{s.quest.xp} XP · 🪙 {s.quest.gold}
          </span>
        </div>
        <div className="small muted" style={{ margin: '4px 0' }}>
          {s.quest.description}
        </div>
        <Bar
          value={s.progress}
          max={s.quest.target}
          color={s.complete ? 'var(--good)' : undefined}
          label={questProgressText(s.progress, s.quest.target, s.quest.unit)}
        />
      </div>
    </li>
  );
}

export function QuestsPage() {
  const { game } = useGame();
  const badges = game.achievements.filter((a) => !a.achievement.milestone);
  const crests = game.achievements.filter((a) => a.achievement.milestone);
  const unlocked = game.achievements.filter((a) => a.unlocked).length;

  return (
    <>
      <h1>Quest board</h1>
      <p className="small muted">Optional prototype challenges, not training prescriptions. Follow your plan; do not add workouts to meet a quest deadline.</p>
      <section className="panel">
        <h2>Daily quest</h2>
        <ul className="list">
          <QuestRow s={game.quests.daily} />
        </ul>
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          A new quest appears every day.
        </p>
      </section>
      <section className="panel">
        <h2>Weekly quests</h2>
        <ul className="list">
          {game.quests.weekly.map((s) => (
            <QuestRow key={s.quest.id} s={s} />
          ))}
        </ul>
        <p className="tiny muted" style={{ marginBottom: 0 }}>
          New quests every Monday. {game.quests.completedIds.length} quests completed all-time.
        </p>
      </section>

      <section className="panel">
        <div className="row between">
          <h2>Level crests</h2>
        </div>
        <div className="badge-grid">
          {crests.map(({ achievement: a, unlocked: u }) => (
            <div key={a.id} className={`badge${u ? '' : ' locked'}`} title={a.description}>
              <div className="ico">{a.icon}</div>
              <div className="name">{a.name}</div>
              <div className="tiny muted">Lv {a.target}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="panel">
        <div className="row between">
          <h2>Badges</h2>
          <span className="small muted">
            {unlocked} / {game.achievements.length}
          </span>
        </div>
        <div className="badge-grid">
          {badges.map(({ achievement: a, unlocked: u, value }) => (
            <div key={a.id} className={`badge${u ? '' : ' locked'}`}>
              <div className="ico">{a.icon}</div>
              <div className="name">{a.name}</div>
              <div className="tiny muted" style={{ marginTop: 4 }}>
                {a.description}
              </div>
              {!u && a.target > 1 && (
                <div style={{ marginTop: 6 }}>
                  <Bar value={value} max={a.target} />
                </div>
              )}
              <div className="tiny gold" style={{ marginTop: 4 }}>
                🪙 {a.gold}
              </div>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
