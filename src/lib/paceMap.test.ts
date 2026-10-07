import { expect, it } from 'vitest';
import { paceMap } from './paceMap';
import type { TrackPoint } from '../game/types';

it('colors valid pace, marks unknown fixes gray, and never bridges pauses', () => {
  const points: TrackPoint[] = [[0, 0, 0, null, 0], [0.0002, 0, 1000, null, 0],
    [0.0004, 0, 10000, null, 0], [1, 0, 20000, null, 1], [1.0004, 0, 30000, null, 1]];
  const result = paceMap(points);
  expect(result.edges).toHaveLength(3);
  expect(result.edges[0].color).toBe('#b3a5c9');
  expect(result.edges[1].color).not.toBe('#b3a5c9');
  expect(result.fast).not.toBeNull();
  expect(paceMap([]).edges).toEqual([]);
});

it('merges uniform runs for long-route rendering without joining equal-color segments', () => {
  const points: TrackPoint[] = Array.from({ length: 5000 }, (_, i) => [i * 0.0001, 0, i * 5000, null, 0]);
  const result = paceMap(points);
  expect(result.edges.length).toBeLessThan(10);
  expect(result.edges.at(-1)?.color).toBe('#ffcc33');
  const separated = paceMap([[0, 0, 0, null, 0], [0, 0.00001, 1000, null, 0],
    [0, 0.00002, 2000, null, 1], [0, 0.00003, 3000, null, 1]]);
  expect(separated.edges).toHaveLength(2);
  expect(separated.fast).toBeNull();
  expect(paceMap([[0, 0, 0, null, 0]]).edges).toEqual([]);
});
