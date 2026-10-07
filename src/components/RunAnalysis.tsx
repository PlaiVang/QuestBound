import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { Run, TrackPoint, Units } from '../game/types';
import { routeSeries, runLaps } from '../lib/analytics';
import { formatDistance, formatDuration, formatPace } from '../lib/format';
import { RouteReplay } from './RouteMap';
import { Stat } from './ui';

export function RunAnalysis({ run, points, units }: { run: Run; points: TrackPoint[] | null; units: Units }) {
  const [view, setView] = useState<'map' | 'charts'>('map');
  const laps = useMemo(() => runLaps(run, points ?? [], units), [run, points, units]);
  const series = useMemo(() => routeSeries(points ?? [], units), [points, units]);
  const segments = [...new Set(series.map(p => p.segment))];
  const fullLaps = laps.filter(l => !l.partial);
  const fastest = fullLaps.length ? Math.min(...fullLaps.map(l => l.seconds)) : null;
  const slowest = fullLaps.length ? Math.max(...fullLaps.map(l => l.seconds)) : null;
  return <>
    <section className="panel">
      <h2>Workout summary</h2>
      {run.simulated && <p className="small">Simulated test run: route and measurements are synthetic.</p>}
      <div className="grid-2">
        <Stat label="Distance" value={formatDistance(run.distanceM, units)} />
        <Stat label="Duration" value={formatDuration(run.durationSec)} />
        <Stat label={`Avg. pace /${units}`} value={formatPace(run.distanceM, run.durationSec, units).replace(/ \/.*/, '')} />
        <Stat label="Elevation gain" value={run.importedFrom ? 'Not imported' : `${units === 'mi' ? Math.round(run.elevationGainM * 3.28084) : run.elevationGainM} ${units === 'mi' ? 'ft' : 'm'}`} />
      </div>
      <p className="tiny muted">{run.importedFrom ? 'Samsung Health import · elapsed session duration · laps estimated at even pace · no route imported.'
        : run.source === 'manual' ? 'Manually logged · laps estimated at even pace.' : 'GPS recorded · route analysis excludes pauses and missing GPS sections.'}</p>
    </section>
    <section className="panel">
      <h2>Route analysis</h2>
      <div className="segmented" role="group" aria-label="Route analysis view">
        <button aria-pressed={view === 'map'} className={view === 'map' ? 'on' : ''} onClick={() => setView('map')}>Map</button>
        <button aria-pressed={view === 'charts'} className={view === 'charts' ? 'on' : ''} onClick={() => setView('charts')}>Charts</button>
      </div>
      {points === null && run.source === 'gps' ? <p role="status">Loading route…</p> : view === 'map'
        ? <RouteReplay points={points ?? []} units={units} />
        : <>
          {(['pace', 'elevation'] as const).map(metric => {
            const available = series.filter(p => p[metric] !== null);
            const feet = metric === 'elevation' && units === 'mi';
            return <div key={metric} className="run-chart">
              <h3>{metric === 'pace' ? `Pace /${units}` : `Elevation (${feet ? 'ft' : 'm'})`}</h3>
              {available.length < 2 ? <p className="small muted">Not enough recorded {metric} data.</p>
                : <ResponsiveContainer width="100%" height={200}>
                  <LineChart margin={{ left: -12, right: 12, bottom: 10 }}>
                    <CartesianGrid stroke="#5b4780" vertical={false} />
                    <XAxis type="number" dataKey="distance" domain={['dataMin', 'dataMax']} tickFormatter={v => Number(v).toFixed(1)} label={{ value: `Distance (${units})`, position: 'insideBottom', offset: -8 }} />
                    <YAxis reversed={metric === 'pace'} domain={['auto', 'auto']} tickFormatter={v => metric === 'pace' ? formatDuration(Number(v)) : String(Math.round(Number(v) * (feet ? 3.28084 : 1)))} />
                    <Tooltip contentStyle={{ background: '#261c36', borderColor: '#5b4780' }} labelFormatter={v => `${Number(v).toFixed(2)} ${units}`}
                      formatter={v => [metric === 'pace' ? formatDuration(Number(v)) : `${Math.round(Number(v) * (feet ? 3.28084 : 1))} ${feet ? 'ft' : 'm'}`, metric]} />
                    {segments.map(segment => <Line key={segment} data={series.filter(p => p.segment === segment)} dataKey={metric} name={metric}
                      stroke={metric === 'pace' ? '#ff8a3d' : '#4fc3f7'} dot={false} strokeWidth={2} isAnimationActive={false} connectNulls={false} />)}
                  </LineChart>
                </ResponsiveContainer>}
            </div>;
          })}
          <p className="tiny muted">Pace uses a short smoothing window. GPS elevation may be noisy; gaps are not connected.</p>
        </>}
    </section>
    <section className="panel">
      <h2>Laps{run.source === 'manual' ? ' (estimated)' : ''}</h2>
      {laps.length === 0 ? <p className="small muted">{run.source === 'gps' ? 'No usable route data for lap analysis.' : 'No distance recorded.'}</p> : <>
        <div className="lap-table-scroll">
          <table className="splits lap-table">
            <thead><tr><th scope="col">Lap</th><th scope="col">Time</th><th scope="col">{units}</th><th scope="col">Pace /{units}</th></tr></thead>
            <tbody>{laps.map((lap, i) => <tr key={i}>
              <th scope="row">{i + 1}{lap.partial ? '*' : ''}</th>
              <td>{formatDuration(lap.seconds)}</td><td>{formatDistance(lap.distanceM, units).split(' ')[0]}</td>
              <td>{formatPace(lap.distanceM, lap.seconds, units).replace(/ \/.*/, '')}</td>
            </tr>)}</tbody>
          </table>
        </div>
        {laps.some(l => l.partial) && <p className="tiny muted">* Final partial lap</p>}
        {fastest !== null && slowest !== null && <p className="small">Full laps: fastest {formatDuration(fastest)} · slowest {formatDuration(slowest)}</p>}
      </>}
    </section>
  </>;
}
