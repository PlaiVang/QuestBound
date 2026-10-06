import { baselineFrom, classifyRun } from './classes';
import type { ClassId, Run, TrackPoint } from './types';
import {
  computeBestEfforts,
  computeSplits,
  elevationGain,
  evenPaceEfforts,
  evenPaceSplits,
  paceVariability,
  trackDistance,
} from '../lib/geo';
import { uid } from '../lib/format';

export function runFromTrack(
  points: TrackPoint[],
  startedAt: number,
  movingSec: number,
  priorRuns: Run[],
  classOverride?: ClassId,
): Run {
  const distanceM = trackDistance(points);
  const elev = elevationGain(points);
  const variability = paceVariability(points);
  const durationSec = Math.round(movingSec);
  const prior = priorRuns.filter((r) => r.startedAt < startedAt).sort((a, b) => a.startedAt - b.startedAt);
  return {
    id: uid(),
    startedAt,
    durationSec,
    distanceM: Math.round(distanceM),
    elevationGainM: elev,
    source: 'gps',
    autoClass: classifyRun({ distanceM, durationSec, elevationGainM: elev, paceVariability: variability }, baselineFrom(prior)),
    classOverride,
    splits: computeSplits(points),
    bestEfforts: computeBestEfforts(points),
    paceVariability: variability,
  };
}

export function manualRun(
  input: { startedAt: number; distanceM: number; durationSec: number; elevationGainM: number; notes?: string },
  priorRuns: Run[],
  classOverride?: ClassId,
): Run {
  const prior = priorRuns.filter((r) => r.startedAt < input.startedAt).sort((a, b) => a.startedAt - b.startedAt);
  return {
    id: uid(),
    ...input,
    source: 'manual',
    autoClass: classifyRun({ ...input, paceVariability: null }, baselineFrom(prior)),
    classOverride,
    splits: evenPaceSplits(input.distanceM, input.durationSec),
    bestEfforts: evenPaceEfforts(input.distanceM, input.durationSec),
    paceVariability: null,
  };
}
