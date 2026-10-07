import { useState } from 'react';
import type { Run } from '../game/types';
import { validateHeartRate } from '../lib/heartRate';
import { useGame } from '../state/GameContext';
import { Stat } from './ui';

export function HeartRateMetrics({ run }: { run: Run }) {
  const { saveRun } = useGame();
  const [average, setAverage] = useState(run.heartRate ? String(run.heartRate.averageBpm) : '');
  const [maximum, setMaximum] = useState(run.heartRate ? String(run.heartRate.maxBpm) : '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const save = async (remove = false) => {
    setBusy(true); setError(''); setMessage('');
    try {
      const heartRate = remove ? undefined : { averageBpm: Number(average), maxBpm: Number(maximum), source: 'manual' as const };
      if (heartRate) validateHeartRate(heartRate);
      await saveRun({ ...run, heartRate });
      if (remove) { setAverage(''); setMaximum(''); }
      setMessage(remove ? 'Heart rate removed.' : 'Measured heart rate saved.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Unable to save heart rate. Try again.'); }
    finally { setBusy(false); }
  };
  return <section className="panel">
    <h2>Heart rate</h2>
    {run.heartRate ? <div className="grid-2">
      <Stat label="Average" value={`${run.heartRate.averageBpm} bpm`} />
      <Stat label="Maximum" value={`${run.heartRate.maxBpm} bpm`} />
    </div> : <p className="small muted">Not recorded</p>}
    <p className="small muted">{run.heartRate?.source === 'health-connect' ? 'Imported Samsung Health samples via Health Connect. ' : 'Manually entered measurements. '}Enter readings from your watch or heart-rate sensor to update them. GPS never estimates heart rate. Live watch recording and heart-rate zones are not available yet.</p>
    <form onSubmit={e => { e.preventDefault(); void save(); }}>
      <div className="grid-2">
        <label className="field">Average bpm<input type="number" min="30" max="250" step="1" required value={average} onChange={e => setAverage(e.target.value)} /></label>
        <label className="field">Maximum bpm<input type="number" min="30" max="250" step="1" required value={maximum} onChange={e => setMaximum(e.target.value)} /></label>
      </div>
      <div className="row wrap">
        <button className="btn" disabled={busy} type="submit">{busy ? 'Saving…' : 'Save heart rate'}</button>
        {run.heartRate && <button className="btn ghost" disabled={busy} type="button" onClick={() => void save(true)}>Remove readings</button>}
      </div>
    </form>
    {error && <p role="alert" className="small">{error}</p>}
    {message && <p role="status" className="small">{message}</p>}
  </section>;
}
