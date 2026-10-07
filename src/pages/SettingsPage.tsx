import { lazy, Suspense, useRef, useState } from 'react';
import { db } from '../data/db';
import { CLASSES, CLASS_IDS } from '../game/classes';
import type { Units } from '../game/types';
import { useGame } from '../state/GameContext';
import { SamsungHealthSettings } from '../components/SamsungHealthSettings';
import { TestingDiagnostics } from '../components/TestingDiagnostics';
import { featureFlags } from '../config/featureFlags';
import { exportJson } from '../lib/exportJson';

const AccountSettings = lazy(() => import('../components/AccountSettings').then(m => ({ default: m.AccountSettings })));
export function SettingsPage() {
  const { profile, saveProfile, reload } = useGame();
  const [name, setName] = useState<string | null>(null);
  const [status, setStatus] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);

  const persistProfile = async (heroName: string, units: Units) => {
    setBusy(true);
    try {
      await saveProfile({ heroName, units });
      setName(null);
      setStatus('Settings saved.');
    } catch (e) {
      setStatus(`Settings could not be saved: ${e instanceof Error ? e.message : 'Try again.'}`);
    } finally {
      setBusy(false);
    }
  };
  const setUnits = (units: Units) => persistProfile(profile.heroName, units);

  const exportData = async () => {
    try {
      const filename = `questbound-backup-${new Date().toISOString().slice(0, 10)}.json`;
      await exportJson(await db.exportBackup(), filename, 'QuestBound backup');
      setStatus('Backup exported.');
    } catch (e) {
      setStatus(`Export failed: ${(e as Error).message}`);
    }
  };

  const importData = async (file: File) => {
    if (!confirm('Importing replaces ALL current runs, rewards and settings. Continue?')) return;
    try {
      await db.importBackup(JSON.parse(await file.text()));
      await reload();
      setName(null);
      setStatus('Backup restored.');
    } catch (e) {
      setStatus(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <>
      <h1>Settings</h1>
      {featureFlags.accounts && <Suspense fallback={<section className="panel" role="status">Loading account…</section>}><AccountSettings /></Suspense>}
      {featureFlags.samsungHealthImport && <SamsungHealthSettings />}
      <TestingDiagnostics />
      <section className="panel">
        <h2>Hero</h2>
        <div>
          <label className="field">
            <span>Hero name</span>
            <input name="hero-name" autoComplete="off" value={name ?? profile.heroName} maxLength={24} onChange={(e) => setName(e.target.value)} />
          </label>
          <button className="btn" disabled={busy} onClick={() => {
            const heroName = (name ?? profile.heroName).trim();
            if (!heroName) { setStatus('Enter a hero name before saving.'); return; }
            void persistProfile(heroName, profile.units);
          }}>{busy ? 'Saving…' : 'Save hero name'}</button>
          <div>
            <div className="small muted" style={{ marginBottom: 6 }}>
              Units
            </div>
            <div className="segmented">
              {(['km', 'mi'] as Units[]).map((u) => (
                <button key={u} aria-pressed={profile.units === u} disabled={busy} className={profile.units === u ? 'on' : ''} onClick={() => setUnits(u)}>
                  {u === 'km' ? 'Kilometers' : 'Miles'}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="panel">
        <h2>Backup</h2>
        <p className="small muted">Your data lives only on this device. Export a backup regularly.</p>
        <div className="row">
          <button className="btn grow" onClick={exportData}>
            ⬇️ Export
          </button>
          <button className="btn grow" onClick={() => fileRef.current?.click()}>
            ⬆️ Import
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          aria-label="Import QuestBound backup"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) importData(f);
          }}
        />
        {status && <p className="small" role="status">{status}</p>}
      </section>

      <section className="panel small">
        <h2>How the game works</h2>
        <p>
          <b>XP:</b> every run earns 10 XP per km plus 1 XP per minute. Your character levels up from total XP.
        </p>
        <p>
          <b>Classes:</b> each run is assigned a class based on how you ran it. You can override it on the run page.
        </p>
        <ul>
          {CLASS_IDS.map((id) => (
            <li key={id}>
              <PixelArt name={id} /> <b>{CLASSES[id].name}</b>: {CLASSES[id].description}
            </li>
          ))}
        </ul>
        <p>
          <b>Fatigue:</b> to discourage overtraining, distance beyond your weekly cap (1.3× your recent average, at least 20 km) earns
          reduced XP.
        </p>
        <p>
          <b>Gold:</b> 5 gold per km, plus bonuses from quests, bosses and badges. Spend it on real-life rewards at the Merchant.
        </p>
        <p>
          <b>World:</b> your distance walks you across the Realm. Bosses guard each gate. Beat their challenge in a single run to pass.
        </p>
        <p>
          <b>Streak:</b> run at least twice a week to keep your weekly streak alive.
        </p>
      </section>
    </>
  );
}
import { PixelArt } from '../components/PixelArt';
