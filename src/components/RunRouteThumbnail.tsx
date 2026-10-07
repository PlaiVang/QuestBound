import { useEffect, useRef, useState } from 'react';
import { db } from '../data/db';
import type { Run } from '../game/types';
import { routeOutline } from '../lib/routeOutline';
import { PixelArt } from './PixelArt';
import { runClass } from '../game/types';

export function RunRouteThumbnail({ run }: { run: Run }) {
  const container = useRef<HTMLSpanElement>(null);
  const [preview, setPreview] = useState<{ id: string; path: string | null; error: boolean } | null>(null);
  useEffect(() => {
    if (run.source !== 'gps') return;
    let cancelled = false;
    let loaded = false;
    const load = () => {
      if (loaded) return;
      loaded = true;
      void db.points(run.id).then(points => {
        if (!cancelled) setPreview({ id: run.id, path: routeOutline(points), error: false });
      }).catch(() => {
        if (!cancelled) setPreview({ id: run.id, path: null, error: true });
      });
    };
    const observer = new IntersectionObserver(entries => {
      if (entries.some(entry => entry.isIntersecting)) {
        observer.disconnect();
        load();
      }
    }, { rootMargin: '200px' });
    if (container.current) observer.observe(container.current);
    return () => { cancelled = true; observer.disconnect(); };
  }, [run.id, run.source]);
  const current = preview?.id === run.id ? preview : null;
  const label = run.source === 'manual' ? 'Manual run'
    : !current ? 'Loading route preview'
      : current.error ? 'Route preview unavailable. Open run details.'
        : current.path ? 'Recorded GPS route' : 'No usable GPS route recorded';
  return <span ref={container} className="run-route-thumbnail" title={label}>
    {current?.path ? <svg viewBox="0 0 96 96" role="img" aria-label={label}>
      <path d={current.path} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg> : current?.error ? <span role="img" aria-label={label}>!</span>
      : <PixelArt name={runClass(run)} size={48} label={label} />}
    {current?.error && <span className="tiny" role="status">Preview unavailable</span>}
  </span>;
}
