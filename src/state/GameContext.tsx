import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { db } from '../data/db';
import { computeGame, type GameView } from '../game/engine';
import type { Profile, Redemption, Reward, Run, TrackPoint } from '../game/types';
import { DEFAULT_PROFILE, DEFAULT_REWARDS } from '../data/db';
import { uid } from '../lib/format';

interface GameContextValue {
  ready: boolean;
  runs: Run[];
  profile: Profile;
  rewards: Reward[];
  redemptions: Redemption[];
  game: GameView;
  saveRun: (run: Run, points?: TrackPoint[]) => Promise<void>;
  deleteRun: (id: string) => Promise<void>;
  saveProfile: (p: Profile) => Promise<void>;
  saveRewards: (r: Reward[]) => Promise<void>;
  redeem: (reward: Reward) => Promise<boolean>;
  reload: () => Promise<void>;
}

const GameContext = createContext<GameContextValue | null>(null);

export function GameProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);
  const [profile, setProfile] = useState<Profile>(DEFAULT_PROFILE);
  const [rewards, setRewards] = useState<Reward[]>(DEFAULT_REWARDS);
  const [redemptions, setRedemptions] = useState<Redemption[]>([]);

  const reload = useCallback(async () => {
    const [r, p, rw, rd] = await Promise.all([db.runs(), db.profile(), db.rewards(), db.redemptions()]);
    setRuns(r);
    setProfile(p);
    setRewards(rw);
    setRedemptions(rd);
  }, []);

  useEffect(() => {
    db.init()
      .then(reload)
      .catch((e) => console.error('Failed to open database', e))
      .finally(() => setReady(true));
  }, [reload]);

  const game = useMemo(() => computeGame(runs, redemptions), [runs, redemptions]);

  const value = useMemo<GameContextValue>(
    () => ({
      ready,
      runs,
      profile,
      rewards,
      redemptions,
      game,
      reload,
      async saveRun(run, points) {
        await db.saveRun(run, points);
        setRuns((prev) => [...prev.filter((r) => r.id !== run.id), run]);
      },
      async deleteRun(id) {
        await db.deleteRun(id);
        setRuns((prev) => prev.filter((r) => r.id !== id));
      },
      async saveProfile(p) {
        await db.saveProfile(p);
        setProfile(p);
      },
      async saveRewards(r) {
        await db.saveRewards(r);
        setRewards(r);
      },
      async redeem(reward) {
        if (game.gold.balance < reward.cost) return false;
        const next = [
          ...redemptions,
          { id: uid(), rewardId: reward.id, name: reward.name, icon: reward.icon, cost: reward.cost, at: Date.now() },
        ];
        await db.saveRedemptions(next);
        setRedemptions(next);
        return true;
      },
    }),
    [ready, runs, profile, rewards, redemptions, game, reload],
  );

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>;
}

export function useGame() {
  const ctx = useContext(GameContext);
  if (!ctx) throw new Error('useGame must be used inside GameProvider');
  return ctx;
}
