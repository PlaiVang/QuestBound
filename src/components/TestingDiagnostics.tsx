import { useState } from 'react';
import { featureFlags } from '../config/featureFlags';
import { diagnostics } from '../diagnostics/recorder';
import { exportJson } from '../lib/exportJson';
import { useGame } from '../state/GameContext';
import { simulatedRuns } from '../testing/simulatedRuns';
import { runSession } from '../tracking/runSession';

export function TestingDiagnostics() {
  const { runs, saveRun, deleteRun } = useGame();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [enabled, setEnabled] = useState(() => diagnostics.status().enabled);
  if (!featureFlags.diagnostics && !featureFlags.testTools) return null;
  const action = async (task: () => Promise<string>) => {
    setBusy(true); setError(''); setMessage('');
    try { setMessage(await task()); }
    catch (e) { setError(e instanceof Error ? e.message : 'Testing action failed.'); }
    finally { setBusy(false); }
  };
  const assertIdle = () => {
    const snapshot = runSession.getSnapshot();
    if (snapshot.status !== 'idle' || snapshot.countdown !== null) throw new Error('Finish the active run before changing test data.');
  };
  return <section className="panel">
    <h2>Testing &amp; diagnostics</h2>
    {featureFlags.diagnostics && <>
      <label className="row small"><input type="checkbox" checked={enabled} disabled={busy} onChange={e => {
        const value = e.target.checked;
        void action(async () => { diagnostics.setEnabled(value); setEnabled(value); return value ? 'Local diagnostics enabled.' : 'Diagnostics disabled and cleared.'; });
      }} />Keep local diagnostic events</label>
      <p className="tiny muted">Only state changes, error codes and GPS acceptance/rejection counts. No coordinates, run IDs, heart-rate readings, email, passwords or tokens. Nothing is uploaded. Keeps the latest 200 events across restarts.</p>
      <div className="row wrap">
        <button className="btn" disabled={busy} onClick={() => void action(async () => {
          await exportJson(diagnostics.export(), `questbound-diagnostics-${Date.now()}.json`, 'QuestBound diagnostics');
          return 'Diagnostic export opened. Review before sharing.';
        })}>Export diagnostics</button>
        <button className="btn ghost" disabled={busy} onClick={() => void action(async () => { diagnostics.clear(); return 'Diagnostics cleared.'; })}>Clear diagnostics</button>
      </div>
      {diagnostics.status().persistenceFailed && <p role="alert" className="small">Diagnostic storage failed. Events may be memory-only; export before restarting.</p>}
    </>}
    {featureFlags.testTools && <>
      <p className="small">Add six labeled simulated runs to test maps, pace colors, partial laps, missing elevation, GPS gaps, heart rate and trends. They affect PRs and game progress until removed; they are not real workouts.</p>
      <p className="tiny muted">Test data is device-local, not attached to an online account. Addition is repeat-safe and never replaces an existing run.</p>
      <div className="row wrap">
        <button className="btn" disabled={busy} onClick={() => {
          if (!confirm('Add simulated runs to this device? They affect analytics and progression until removed. Existing runs are kept.')) return;
          void action(async () => {
            assertIdle();
            const fixtures = simulatedRuns(Date.now(), runs);
            let count = 0;
            try { for (const { run, points } of fixtures) { await saveRun(run, points); count++; } }
            catch { throw new Error(`${count} simulated runs saved before the failure. Retry safely; existing fixtures are skipped.`); }
            diagnostics.record('test.seeded', { count });
            return `Added ${count} simulated runs. Open Log or Stats to inspect them.`;
          });
        }}>Add simulated runs</button>
        <button className="btn ghost" disabled={busy || !runs.some(r => r.simulated)} onClick={() => {
          if (!confirm('Remove only simulated runs? Real runs and settings are kept.')) return;
          void action(async () => {
            assertIdle();
            const fixtures = runs.filter(r => r.simulated === true);
            for (const run of fixtures) await deleteRun(run.id);
            diagnostics.record('test.removed', { count: fixtures.length });
            return `Removed ${fixtures.length} simulated runs. Real runs were kept.`;
          });
        }}>Remove simulated runs</button>
      </div>
    </>}
    {message && <p className="small" role="status">{message}</p>}
    {error && <p className="small" role="alert">{error}</p>}
  </section>;
}
