import { manualRun, runFromTrack } from '../game/runFactory';
import type { Run, TrackPoint } from '../game/types';

export function simulatedRuns(now: number, prior: Run[]) {
  const out: { run: Run; points: TrackPoint[] }[] = [];
  for (let n = 0; n < 6; n++) {
    const id = `questbound-test-v1-${n}`;
    if (prior.some(r => r.id === id)) continue;
    const startedAt = now - (22 - n * 4) * 86400000;
    const points: TrackPoint[] = [];
    let timestamp = startedAt;
    if (n !== 5) for (let i = 0; i <= 240; i++) {
      timestamp += i ? (5 + 3 * (1 + Math.sin(i / 20))) * 1000 : 0;
      if (n === 3 && i === 121) timestamp += 90000;
      const angle = i / 240 * Math.PI * 2 * (n === 4 ? 2 : 1);
      points.push([0.006 * Math.sin(angle), 0.006 * Math.cos(angle) + (n === 3 && i > 120 ? 0.005 : 0),
        Math.round(timestamp), n === 2 && i > 80 && i < 120 ? null : 20 + 10 * Math.sin(i / 30), n === 3 && i > 120 ? 1 : 0]);
    }
    const earlier = [...prior, ...out.map(f => f.run)];
    const run = n === 5 ? manualRun({ startedAt, distanceM: 5100, durationSec: 1950, elevationGainM: 0 }, earlier)
      : runFromTrack(points, startedAt, (timestamp - startedAt - (n === 3 ? 90000 : 0)) / 1000, earlier);
    run.id = id; run.simulated = true;
    run.notes = 'SIMULATED TEST RUN. Synthetic route near the equator; not a real workout or measured heart rate. Remove via Testing tools.';
    if (n % 2 === 0) run.heartRate = { averageBpm: 135 + n * 3, maxBpm: 160 + n * 3, source: 'manual' };
    out.push({ run, points });
  }
  return out;
}
