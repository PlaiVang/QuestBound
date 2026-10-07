import { NavLink, Outlet, useLocation, Link } from 'react-router-dom';
import { useEffect, useRef } from 'react';
import { runSession } from '../tracking/runSession';
import { useRunSession, useTicker } from '../tracking/useRunSession';
import { formatDistance, formatDuration } from '../lib/format';
import { useGame } from '../state/GameContext';
import { PixelArt } from './PixelArt';
import type { SpriteId } from '../art/sprites';

const NAV: { to: string; icon: SpriteId; label: string; end?: boolean; run?: boolean }[] = [
  { to: '/', icon: 'hero', label: 'Hero', end: true },
  { to: '/world', icon: 'map', label: 'World' },
  { to: '/run', icon: 'run', label: 'Run', run: true },
  { to: '/training', icon: 'plan', label: 'Plan' },
  { to: '/runs', icon: 'log', label: 'Log' },
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

  if (session.countdown !== null) return (
    <main className="app countdown-screen">
      <h1>Get ready</h1>
      <p className="countdown-number" role="status" aria-live="polite" aria-atomic="true">{session.countdown}</p>
      <p>Your run and workout clock start after the countdown.</p>
      <button className="btn block" onClick={runSession.cancelCountdown}>Cancel start</button>
    </main>
  );

  return (
    <>
      <a className="skip-link" href="#main-content" onClick={event => {
        event.preventDefault();
        main.current?.focus();
      }}>Skip to main content</a>
      <main className="app" id="main-content" tabIndex={-1} ref={main}>
        <nav className="utility-nav" aria-label="Secondary navigation">
          <NavLink to="/stats">Stats</NavLink>
          <NavLink to="/quests">Quests</NavLink>
          <NavLink to="/rewards">Shop</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
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
              <span className="ico" aria-hidden="true"><PixelArt name={n.icon} size={32} /></span>
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </>
  );
}
