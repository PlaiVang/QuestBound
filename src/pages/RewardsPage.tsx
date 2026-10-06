import { useState } from 'react';
import { Gold } from '../components/ui';
import type { Reward } from '../game/types';
import { formatDateTime, uid } from '../lib/format';
import { useGame } from '../state/GameContext';

const EMPTY = { name: '', icon: '🎁', cost: 100 };

export function RewardsPage() {
  const { game, rewards, redemptions, redeem, saveRewards } = useGame();
  const [editing, setEditing] = useState<Reward | null>(null);
  const [draft, setDraft] = useState(EMPTY);
  const [message, setMessage] = useState('');

  const startEdit = (r: Reward | null) => {
    setEditing(r);
    setDraft(r ? { name: r.name, icon: r.icon, cost: r.cost } : EMPTY);
  };

  const save = async () => {
    const cost = Math.max(1, Math.round(Number(draft.cost) || 0));
    const name = draft.name.trim();
    if (!name) return;
    const item: Reward = { id: editing?.id ?? uid(), name, icon: draft.icon.trim() || '🎁', cost };
    await saveRewards(editing ? rewards.map((r) => (r.id === item.id ? item : r)) : [...rewards, item]);
    setEditing(null);
    setDraft(EMPTY);
  };

  const remove = async (id: string) => {
    if (!confirm('Remove this reward?')) return;
    await saveRewards(rewards.filter((r) => r.id !== id));
  };

  const buy = async (r: Reward) => {
    if (!confirm(`Spend ${r.cost} gold on "${r.name}"?`)) return;
    const ok = await redeem(r);
    setMessage(ok ? `${r.icon} Enjoy your ${r.name}! You earned it.` : 'Not enough gold yet. Keep running!');
  };

  return (
    <>
      <h1>Merchant</h1>
      <section className="panel row between">
        <div>
          <div className="small muted">Your purse</div>
          <div className="pixel" style={{ fontSize: 18 }}>
            <Gold amount={game.gold.balance} />
          </div>
        </div>
        <div className="tiny muted" style={{ textAlign: 'right' }}>
          Earned {game.gold.earned}
          <br />
          Spent {game.gold.spent}
        </div>
      </section>
      {message && <div className="panel small">{message}</div>}

      <section className="panel">
        <h2>Real-life rewards</h2>
        <p className="small muted">Set rewards for yourself and buy them with the gold you earn from running.</p>
        <ul className="list">
          {rewards.map((r) => (
            <li key={r.id}>
              <span className="icon-lg">{r.icon}</span>
              <div className="grow">
                <div>{r.name}</div>
                <div className="tiny gold">🪙 {r.cost}</div>
              </div>
              <button className="btn small ghost" onClick={() => startEdit(r)} aria-label="Edit">
                ✏️
              </button>
              <button className="btn small ghost" onClick={() => remove(r.id)} aria-label="Remove">
                🗑️
              </button>
              <button className="btn small gold-btn" disabled={game.gold.balance < r.cost} onClick={() => buy(r)}>
                Buy
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2>{editing ? 'Edit reward' : 'Add a reward'}</h2>
        <div>
          <label className="field">
            <span>Icon</span>
            <input value={draft.icon} maxLength={4} onChange={(e) => setDraft({ ...draft, icon: e.target.value })} />
          </label>
          <label className="field">
            <span>Name</span>
            <input value={draft.name} placeholder="e.g. New running socks" onChange={(e) => setDraft({ ...draft, name: e.target.value })} />
          </label>
          <label className="field">
            <span>Cost (gold)</span>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={draft.cost}
              onChange={(e) => setDraft({ ...draft, cost: Number(e.target.value) })}
            />
          </label>
          <div className="row">
            <button className="btn primary grow" onClick={save} disabled={!draft.name.trim()}>
              {editing ? 'Save' : 'Add reward'}
            </button>
            {editing && (
              <button className="btn ghost" onClick={() => startEdit(null)}>
                Cancel
              </button>
            )}
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Purchase history</h2>
        {redemptions.length === 0 && <p className="small muted">Nothing bought yet.</p>}
        <ul className="list small">
          {redemptions
            .slice()
            .reverse()
            .map((r) => (
              <li key={r.id}>
                <span>{r.icon}</span>
                <span className="grow">{r.name}</span>
                <span className="tiny muted">{formatDateTime(r.at)}</span>
                <span className="tiny gold">-{r.cost}</span>
              </li>
            ))}
        </ul>
      </section>
    </>
  );
}
