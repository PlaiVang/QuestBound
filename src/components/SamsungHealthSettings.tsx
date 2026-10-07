import { Capacitor, registerPlugin } from '@capacitor/core';
import { useState } from 'react';
import { prepareHealthRun, type HealthRun } from '../health/import';
import { useGame } from '../state/GameContext';
import { runSession } from '../tracking/runSession';
import { diagnostics } from '../diagnostics/recorder';

const HealthImport = registerPlugin<{ importRuns(): Promise<{ runs: HealthRun[] }> }>('HealthImport');
export function SamsungHealthSettings() {
  const { runs, saveRun } = useGame();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const supported = Capacitor.getPlatform() === 'android';
  const importRuns = async () => {
    setBusy(true); setError(''); setMessage('');
    let saved = 0;
    try {
      diagnostics.record('health.import-started');
      if (runSession.getSnapshot().status !== 'idle' || runSession.getSnapshot().countdown !== null) throw new Error('Finish your active run before importing.');
      const result = await HealthImport.importRuns();
      const prior = runs.slice();
      // Validate the entire batch before writing any records.
      const prepared = result.runs.slice().sort((a, b) => a.startedAt - b.startedAt).flatMap(record => {
        const run = prepareHealthRun(record, prior);
        if (!run) return [];
        prior.push(run);
        return [run];
      });
      for (const run of prepared) { await saveRun(run); saved++; }
      diagnostics.record('health.import-finished', { count: saved });
      setMessage(result.runs.length === 0 ? 'No Samsung Health running sessions were shared in the last 30 days. Check Samsung Health’s Health Connect permissions.'
        : `Imported ${saved} runs. Skipped ${result.runs.length - saved} already logged or matching start times.`);
    } catch (e) {
      diagnostics.record('health.import-failed', { count: saved });
      setError(`${saved ? `${saved} runs were saved before the failure. Retry safely; duplicates are skipped. ` : ''}${e instanceof Error ? e.message : 'Import failed. Try again.'}`);
    }
    finally { setBusy(false); }
  };
  return <section className="panel">
    <h2>Samsung Health</h2>
    <p className="small">Import the last 30 days of running sessions through Android Health Connect, including distance and available heart-rate samples. No data is written back to Samsung Health.</p>
    <p className="small muted">Enable Samsung Health’s sharing of exercise, distance and heart rate in Health Connect first. Imported laps are estimated from elapsed session time. Routes and elevation are not imported. Existing runs or matching start times are skipped.</p>
    <button className="btn" disabled={busy || !supported} onClick={() => void importRuns()}>{busy ? 'Importing…' : 'Import Samsung runs'}</button>
    {!supported && <p className="tiny muted">Available in the Android app only.</p>}
    {error && <p role="alert" className="small">{error}</p>}
    {message && <p role="status" className="small">{message}</p>}
    <p className="tiny muted">Runs stay on this device. Revoke access through Health Connect at any time.</p>
  </section>;
}
