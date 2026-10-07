import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import { Layout } from './components/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { HistoryPage } from './pages/HistoryPage';
import { ManualRunPage } from './pages/ManualRunPage';
import { QuestsPage } from './pages/QuestsPage';
import { RewardsPage } from './pages/RewardsPage';
import { SettingsPage } from './pages/SettingsPage';
import { WorldPage } from './pages/WorldPage';
import { TrainingPage } from './pages/TrainingPage';
import { GameProvider, useGame } from './state/GameContext';
import { featureFlags } from './config/featureFlags';

const AuthProvider = lazy(() => import('./auth/AuthContext').then(m => ({ default: m.AuthProvider })));
const RunPage = lazy(() => import('./pages/RunPage').then(m => ({ default: m.RunPage })));
const RunDetailPage = lazy(() => import('./pages/RunDetailPage').then(m => ({ default: m.RunDetailPage })));
const StatsPage = lazy(() => import('./pages/StatsPage').then(m => ({ default: m.StatsPage })));

function Routed() {
  const { ready, error } = useGame();
  if (!ready) {
    return (
      <div className="loading">
        <div className="pixel">QuestBound</div>
        <div className="small muted">Loading your adventure…</div>
      </div>
    );
  }
  if (error) return (
    <div className="app"><section className="panel">
      <h1>Saved data could not be opened</h1>
      <p role="alert">{error}</p>
      <p>Your data has not been replaced. Restart the app to try again.</p>
      <button className="btn" onClick={() => window.location.reload()}>Try again</button>
    </section></div>
  );
  return (
    <Suspense fallback={<div className="app" role="status">Loading screen…</div>}><Routes>
      <Route element={<Layout />}>
        <Route index element={<DashboardPage />} />
        <Route path="run" element={<RunPage />} />
        <Route path="run/manual" element={<ManualRunPage />} />
        <Route path="runs" element={<HistoryPage />} />
        <Route path="runs/:id" element={<RunDetailPage />} />
        <Route path="stats" element={<StatsPage />} />
        <Route path="training" element={<TrainingPage />} />
        <Route path="world" element={<WorldPage />} />
        <Route path="quests" element={<QuestsPage />} />
        <Route path="rewards" element={<RewardsPage />} />
        <Route path="settings" element={<SettingsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes></Suspense>
  );
}

export default function App() {
  const content = (
    <GameProvider>
      <HashRouter>
        <Routed />
      </HashRouter>
    </GameProvider>
  );
  return featureFlags.accounts ? <Suspense fallback={<div role="status">Loading account…</div>}><AuthProvider>{content}</AuthProvider></Suspense> : content;
}
