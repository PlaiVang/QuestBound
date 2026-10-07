import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./positionSource', () => ({
  createPositionSource: () => ({ start: vi.fn().mockResolvedValue(undefined), stop: vi.fn().mockResolvedValue(undefined) }),
}));
const values = new Map<string, string>();
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-05T12:00:00'));
  values.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key),
  });
  vi.resetModules();
});

describe('planned live sessions', () => {
  it('persists workout association and elapsed time even without GPS fixes', async () => {
    const { runSession } = await import('./runSession');
    const starting = runSession.start('plan:1');
    await vi.advanceTimersByTimeAsync(5000);
    await starting;
    vi.advanceTimersByTime(65000);
    runSession.checkpoint();
    vi.resetModules();
    const { runSession: restored } = await import('./runSession');
    await restored.restore();
    expect(restored.getSnapshot().workoutId).toBe('plan:1');
    expect(restored.getSnapshot().status).toBe('paused');
    expect(restored.movingMs()).toBe(65000);
    await restored.discard();
    vi.useRealTimers();
  });
  it('finish pauses but keeps recovery data until save and discard', async () => {
    const { runSession } = await import('./runSession');
    const starting = runSession.start('plan:2');
    await vi.advanceTimersByTimeAsync(5000);
    await starting;
    vi.advanceTimersByTime(120000);
    const result = await runSession.finish();
    expect(result.movingSec).toBe(120);
    expect((await runSession.finish()).id).toBe(result.id);
    expect(runSession.getSnapshot().status).toBe('paused');
    expect(values.has('questbound:active-run')).toBe(true);
    vi.advanceTimersByTime(60000);
    expect(runSession.movingMs()).toBe(120000);
    await runSession.discard();
    expect(values.has('questbound:active-run')).toBe(false);
    vi.useRealTimers();
  });

  describe('run countdown', () => {
    it('waits exactly five seconds and excludes countdown from workout time', async () => {
      const { runSession } = await import('./runSession');
      const starting = runSession.start();
      expect(runSession.getSnapshot().countdown).toBe(5);
      await vi.advanceTimersByTimeAsync(4000);
      expect(runSession.getSnapshot().countdown).toBe(1);
      expect(runSession.getSnapshot().status).toBe('idle');
      expect(runSession.movingMs()).toBe(0);
      await vi.advanceTimersByTimeAsync(1000);
      expect(await starting).toBe(true);
      expect(runSession.getSnapshot().countdown).toBeNull();
      expect(runSession.getSnapshot().status).toBe('running');
      expect(runSession.movingMs()).toBe(0);
      await runSession.discard();
      const { diagnostics } = await import('../diagnostics/recorder');
      expect(diagnostics.export().events.map(e => e.code)).toEqual(['run.countdown', 'run.started', 'run.discarded']);
      vi.useRealTimers();
    });
    it('cancels without starting or creating recovery data and prevents duplicate starts', async () => {
      const { runSession } = await import('./runSession');
      const starting = runSession.start('plan:1');
      expect(await runSession.start('plan:2')).toBe(false);
      await vi.advanceTimersByTimeAsync(2000);
      runSession.cancelCountdown();
      expect(await starting).toBe(false);
      await vi.advanceTimersByTimeAsync(10000);
      expect(runSession.getSnapshot().status).toBe('idle');
      expect(values.has('questbound:active-run')).toBe(false);
      vi.useRealTimers();
    });
  });
});
