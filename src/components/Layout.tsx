import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { runSession } from '../tracking/runSession';
import { useRunSession, useTicker } from '../tracking/useRunSession';
import { formatDistance, formatDuration } from '../lib/format';
import { useGame } from '../state/GameContext';

const NAV = [
  { to: '/', icon: '🧙', label: 'Hero', end: true },
  { to: '/world', icon: '🗺️', label: 'World' },
  { to: '/run', icon: '🏃', label: 'Run', run: true },
  { to: '/training', icon: '📜', label: 'Plan' },
  { to: '/runs', icon: '📖', label: 'Log' },
];

export function Layout() {
  const session = useRunSession();
  const { profile } = useGame();
  const location = useLocation();
  const active = session.status !== 'idle';
  useTicker(active && location.pathname !== '/run');

  return (
    <>
      <main className="app">
        {active && location.pathname !== '/run' && (
          <Link to="/run" className="run-banner">
            <span>{session.status === 'paused' ? '⏸ Run paused' : '🏃 Run in progress'}</span>
            <span>
              {formatDuration(runSession.movingMs() / 1000)} · {formatDistance(session.distanceM, profile.units)}
            </span>
          </Link>
        )}
        <Outlet />
      </main>
      <nav className="nav">
        <div className="nav-inner">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `${isActive ? 'active' : ''}${n.run ? ' run-btn' : ''}`}>
              <span className="ico">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
