import { useEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Polyline, TileLayer, useMap } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import type { TrackPoint } from '../game/types';

function segments(points: TrackPoint[]): LatLngTuple[][] {
  const out: LatLngTuple[][] = [];
  points.forEach((p, i) => {
    if (i === 0 || points[i - 1][4] !== p[4]) out.push([[p[0], p[1]]]);
    else out[out.length - 1].push([p[0], p[1]]);
  });
  return out;
}

function FitBounds({ points, follow }: { points: TrackPoint[]; follow: boolean }) {
  const map = useMap();
  const fitted = useRef(false);
  useEffect(() => {
    if (!points.length) return;
    if (follow) {
      const p = points[points.length - 1];
      map.setView([p[0], p[1]], Math.max(map.getZoom(), 16), { animate: false });
    } else if (!fitted.current) {
      map.fitBounds(points.map((p) => [p[0], p[1]] as LatLngTuple), { padding: [24, 24], maxZoom: 17 });
      fitted.current = true;
    }
  }, [points, follow, map]);
  return null;
}

interface Props {
  points: TrackPoint[];
  /** Keep the map centered on the latest point (live tracking). */
  follow?: boolean;
  /** Index of the point to highlight (route replay). */
  markerIndex?: number;
  tall?: boolean;
}

export function RouteMap({ points, follow = false, markerIndex, tall }: Props) {
  // Recompute segments only when a new points array arrives.
  const segs = useMemo(() => segments(points), [points]);
  const center: LatLngTuple = points.length ? [points[0][0], points[0][1]] : [51.505, -0.09];
  const marker = markerIndex !== undefined ? points[markerIndex] : follow ? points[points.length - 1] : undefined;
  const start = points[0];
  const end = !follow && points.length > 1 ? points[points.length - 1] : undefined;

  if (!points.length) return <div className={`map map-empty${tall ? ' tall' : ''}`} role="status">
    <p>No usable GPS position yet.</p><p className="small muted">Move outdoors with a clear view of the sky. Your workout timer still works.</p>
  </div>;
  return (
    <div className={`map${tall ? ' tall' : ''}`}>
      <MapContainer center={center} zoom={15} style={{ height: '100%', width: '100%' }} zoomControl={!follow} attributionControl>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        {segs.map((s, i) => (
          <Polyline key={i} positions={s} pathOptions={{ color: '#ff8a3d', weight: 5, opacity: 0.9 }} />
        ))}
        {start && <CircleMarker center={[start[0], start[1]]} radius={6} pathOptions={{ color: '#0d0914', fillColor: '#66bb6a', fillOpacity: 1 }} />}
        {end && <CircleMarker center={[end[0], end[1]]} radius={6} pathOptions={{ color: '#0d0914', fillColor: '#e53935', fillOpacity: 1 }} />}
        {marker && (
          <CircleMarker center={[marker[0], marker[1]]} radius={9} pathOptions={{ color: '#0d0914', weight: 3, fillColor: '#ffcc33', fillOpacity: 1 }} />
        )}
        <FitBounds points={points} follow={follow} />
      </MapContainer>
    </div>
  );
}

/** Animates a marker along a recorded route. */
export function RouteReplay({ points }: { points: TrackPoint[] }) {
  const [index, setIndex] = useState<number | undefined>(undefined);
  const [playing, setPlaying] = useState(false);
  const frame = useRef(0);

  useEffect(() => {
    if (!playing || points.length < 2) return;
    const durationMs = Math.min(15000, Math.max(5000, points.length * 8));
    const t0 = performance.now();
    const tick = (now: number) => {
      const f = Math.min(1, (now - t0) / durationMs);
      setIndex(Math.round(f * (points.length - 1)));
      if (f < 1) frame.current = requestAnimationFrame(tick);
      else setPlaying(false);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [playing, points]);

  if (points.length < 2) return <p className="muted small">No GPS route recorded for this run.</p>;

  return (
    <>
      <RouteMap points={points} markerIndex={index} tall />
      <div className="row between" style={{ marginTop: 10 }}>
        <span className="muted small">{index !== undefined ? `${Math.round((index / (points.length - 1)) * 100)}% of route` : 'Watch your hero retrace the route'}</span>
        <button className="btn gold-btn" onClick={() => setPlaying((p) => !p)}>
          {playing ? '⏸ Pause' : '▶ Replay'}
        </button>
      </div>
    </>
  );
}
