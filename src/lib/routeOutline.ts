import type { TrackPoint } from '../game/types';

/** Fits a local route into a 96px square without joining GPS gaps or pauses. */
export function routeOutline(points: TrackPoint[]): string | null {
  if (points.length < 2) return null;
  const origin = points[0];
  const longitudeScale = Math.cos(origin[0] * Math.PI / 180);
  const projected = points.map(p => ({
    x: (((p[1] - origin[1] + 540) % 360) - 180) * longitudeScale,
    y: origin[0] - p[0],
    segment: p[4],
  }));
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const p of projected) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  const extent = Math.max(maxX - minX, maxY - minY);
  if (!Number.isFinite(extent) || extent === 0) return null;
  const scale = 76 / extent;
  const offsetX = (96 - (maxX - minX) * scale) / 2;
  const offsetY = (96 - (maxY - minY) * scale) / 2;
  let hasLine = false;
  const path = projected.map((p, i) => {
    const connected = i > 0 && projected[i - 1].segment === p.segment;
    if (connected && (projected[i - 1].x !== p.x || projected[i - 1].y !== p.y)) hasLine = true;
    return `${connected ? 'L' : 'M'}${((p.x - minX) * scale + offsetX).toFixed(2)},${((p.y - minY) * scale + offsetY).toFixed(2)}`;
  }).join(' ');
  return hasLine ? path : null;
}
