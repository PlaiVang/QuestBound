import { beforeEach, expect, it, vi } from 'vitest';

const values = new Map<string, string>();
beforeEach(() => {
  values.clear(); vi.resetModules();
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => values.get(k) ?? null,
    setItem: (k: string, v: string) => values.set(k, v),
    removeItem: (k: string) => values.delete(k),
  });
});
it('caps persistent events and redacts arbitrary metadata', async () => {
  const { diagnostics } = await import('./recorder');
  const sensitive = { count: 5, email: 'private@example.test', token: 'secret', latitude: 50 };
  for (let i = 0; i < 250; i++) diagnostics.record('storage.run-saved', sensitive);
  const capture = diagnostics.export();
  expect(capture.schemaVersion).toBe(1);
  expect(capture.events).toHaveLength(200);
  expect(capture.events[0].data).toEqual({ count: 5 });
  expect(JSON.stringify(capture)).not.toMatch(/secret|private@example|latitude/);
  vi.resetModules();
  const { diagnostics: reloaded } = await import('./recorder');
  expect(reloaded.export().events).toHaveLength(200);
});
it('batches GPS results, flushes partial batches and clears on opt-out', async () => {
  const { diagnostics } = await import('./recorder');
  for (let i = 0; i < 30; i++) diagnostics.gps(i < 20 ? 'accepted' : 'inaccurate');
  expect(diagnostics.export().events[0].data).toEqual({ accepted: 20, inaccurate: 10 });
  diagnostics.gps('jump');
  expect(diagnostics.export().events[1].data).toEqual({ jump: 1 });
  diagnostics.setEnabled(false);
  diagnostics.record('run.started');
  expect(diagnostics.export().events).toEqual([]);
  vi.resetModules();
  const { diagnostics: reloaded } = await import('./recorder');
  expect(reloaded.status().enabled).toBe(false);
});
it('retains memory-only events without interrupting runs when storage fails', async () => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('quota'); }, removeItem: () => {} });
  const { diagnostics } = await import('./recorder');
  expect(() => diagnostics.record('run.started')).not.toThrow();
  expect(diagnostics.export().persistenceFailed).toBe(true);
  expect(diagnostics.export().events[0].code).toBe('run.started');
});
