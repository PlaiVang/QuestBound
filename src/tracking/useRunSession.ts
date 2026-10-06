import { useEffect, useState, useSyncExternalStore } from 'react';
import { runSession } from './runSession';

export function useRunSession() {
  return useSyncExternalStore(runSession.subscribe, runSession.getSnapshot);
}

/** Re-renders every second while `active`, for live clocks. */
export function useTicker(active: boolean) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [active]);
}
