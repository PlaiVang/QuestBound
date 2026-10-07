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
    await runSession.start('plan:1');
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
    await runSession.start('plan:2');
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
});
