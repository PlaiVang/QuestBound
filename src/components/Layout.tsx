import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
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
  const main = useRef<HTMLElement>(null);
  useEffect(() => {
    window.scrollTo(0, 0);
    main.current?.focus({ preventScroll: true });
  }, [location.pathname]);
  const active = session.status !== 'idle';
  useTicker(active && location.pathname !== '/run');

  return (
    <>
      <a className="skip-link" href="#main-content" onClick={event => {
        event.preventDefault();
        main.current?.focus();
      }}>Skip to main content</a>
      <main className="app" id="main-content" tabIndex={-1} ref={main}>
        <div className="utility-nav">
          <Link to="/stats">Stats</Link>
          <Link to="/quests">Quests</Link>
          <Link to="/rewards">Shop</Link>
          <Link to="/settings">Settings</Link>
        </div>
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
      <nav className="nav" aria-label="Primary navigation">
        <div className="nav-inner">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `${isActive ? 'active' : ''}${n.run ? ' run-btn' : ''}`}>
              <span className="ico" aria-hidden="true">{n.icon}</span>
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
