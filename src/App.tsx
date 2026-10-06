import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { HistoryPage } from './pages/HistoryPage';
import { ManualRunPage } from './pages/ManualRunPage';
import { QuestsPage } from './pages/QuestsPage';
import { RewardsPage } from './pages/RewardsPage';
import { RunDetailPage } from './pages/RunDetailPage';
import { RunPage } from './pages/RunPage';
import { SettingsPage } from './pages/SettingsPage';
import { StatsPage } from './pages/StatsPage';
import { WorldPage } from './pages/WorldPage';
import { GameProvider, useGame } from './state/GameContext';

function Routed() {
  const { ready } = useGame();
  if (!ready) {
    return (
      <div className="loading">
        <div className="pixel">QuestBound</div>
        <div className="small muted">Loading your adventure…</div>
      </div>
    );
  }
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="run" element={<RunPage />} />
        <Route path="run/manual" element={<ManualRunPage />} />
        <Route path="runs" element={<HistoryPage />} />
        <Route path="runs/:id" element={<RunDetailPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="world" element={<WorldPage />} />
        <Route path="quests" element={<QuestsPage />} />
        <Route path="rewards" element={<RewardsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <GameProvider>
      <HashRouter>
        <Routed />
      </HashRouter>
    </GameProvider>
  );
}
