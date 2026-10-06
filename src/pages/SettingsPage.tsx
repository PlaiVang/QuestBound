import { Capacitor } from '@capacitor/core';
import { Directory, Encoding, Filesystem } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';
import { useRef, useState } from 'react';
import { db } from '../data/db';
import { CLASSES, CLASS_IDS } from '../game/classes';
import type { Units } from '../game/types';
import { useGame } from '../state/GameContext';

export function SettingsPage() {
  const { profile, saveProfile, reload } = useGame();
  const [name, setName] = useState(profile.heroName);
  const [status, setStatus] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const setUnits = (units: Units) => saveProfile({ ...profile, units });

  const exportData = async () => {
    try {
      const json = JSON.stringify(await db.exportBackup());
      const filename = `questbound-backup-${new Date().toISOString().slice(0, 10)}.json`;
      if (Capacitor.isNativePlatform()) {
        const res = await Filesystem.writeFile({ path: filename, data: json, directory: Directory.Cache, encoding: Encoding.UTF8 });
        await Share.share({ title: 'QuestBound backup', url: res.uri });
      } else {
        const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      }
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
      setStatus('Backup restored.');
    } catch (e) {
      setStatus(`Import failed: ${(e as Error).message}`);
    }
  };

  return (
    <>
      <h1>Settings</h1>
      <section className="panel">
        <h2>Hero</h2>
        <div>
          <label className="field">
            <span>Hero name</span>
            <input value={name} maxLength={24} onChange={(e) => setName(e.target.value)} onBlur={() => name.trim() && saveProfile({ ...profile, heroName: name.trim() })} />
          </label>
          <div>
            <div className="small muted" style={{ marginBottom: 6 }}>
              Units
            </div>
            <div className="segmented">
              {(['km', 'mi'] as Units[]).map((u) => (
                <button key={u} className={profile.units === u ? 'on' : ''} onClick={() => setUnits(u)}>
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
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) importData(f);
          }}
        />
        {status && <p className="small">{status}</p>}
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
              {CLASSES[id].icon} <b>{CLASSES[id].name}</b>: {CLASSES[id].description}
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
