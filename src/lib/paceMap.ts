import type { TrackPoint } from '../game/types';
import { routeSeries } from './analytics';

export function paceMap(points: TrackPoint[]) {
  const series = routeSeries(points, 'km');
  const valid = series.flatMap(p => p.pace === null ? [] : [p.pace]).sort((a, b) => a - b);
  const fast = valid.length ? valid[Math.floor((valid.length - 1) * 0.1)] : null;
  const slow = valid.length ? valid[Math.floor((valid.length - 1) * 0.9)] : null;
  const colors = ['#4fc3f7', '#66bb6a', '#ffcc33', '#ff8a3d', '#e85b59'];
  const edges: { positions: [number, number][]; color: string }[] = [];
  points.forEach((p, i) => {
    if (i === 0 || points[i - 1][4] !== p[4]) return;
    const pace = series[i].pace;
    const fraction = pace === null || fast === null || slow === null ? null
      : slow - fast < 1 ? 0.5 : Math.max(0, Math.min(1, (pace - fast) / (slow - fast)));
    const color = fraction === null ? '#b3a5c9' : colors[Math.min(4, Math.floor(fraction * 5))];
    const last = edges[edges.length - 1];
    if (last?.color === color && i > 1 && points[i - 2][4] === p[4]) last.positions.push([p[0], p[1]]);
    else edges.push({ positions: [[points[i - 1][0], points[i - 1][1]], [p[0], p[1]]], color });
  });
  return { edges, fast, slow };
}
