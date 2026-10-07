import { describe, expect, it } from 'vitest';
import type { TrackPoint } from '../game/types';
import { routeOutline } from './routeOutline';

const point = (lat: number, lon: number, segment = 0): TrackPoint => [lat, lon, 0, null, segment];

describe('route outline', () => {
  it('does not invent routes for empty, single, stationary, or disconnected fixes', () => {
    expect(routeOutline([])).toBeNull();
    expect(routeOutline([point(0, 0)])).toBeNull();
    expect(routeOutline([point(0, 0), point(0, 0)])).toBeNull();
    expect(routeOutline([point(0, 0), point(1, 1, 1)])).toBeNull();
  });
  it('centers and fits horizontal and vertical routes with padding', () => {
    expect(routeOutline([point(0, 0), point(0, 1)])).toBe('M10.00,48.00 L86.00,48.00');
    expect(routeOutline([point(0, 0), point(1, 0)])).toBe('M48.00,86.00 L48.00,10.00');
  });
  it('preserves separate segments instead of drawing shortcuts', () => {
    const path = routeOutline([point(0, 0), point(0, 1), point(1, 0, 1), point(1, 1, 1)]);
    expect(path).toBe('M10.00,86.00 L86.00,86.00 M10.00,10.00 L86.00,10.00');
  });
  it('keeps a route crossing the date line local', () => {
    expect(routeOutline([point(0, 179.9), point(0, -179.9)])).toBe('M10.00,48.00 L86.00,48.00');
  });
});
