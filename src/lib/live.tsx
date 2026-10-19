/**
 * Live data for every screen. Polls api/version.php every 5 s while the tab is
 * visible and refetches api/data.php only when the counter changed (cheap on
 * shared hosting; no websockets or long-lived requests). Also refetches when
 * the tab becomes visible again or the network comes back.
 *
 * If the network drops, screens keep the last data; `offline` + `updatedAt`
 * let them show "offline, last updated 07.12" instead of going blank.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api } from './api';
import { clockOffset } from './time';
import type { BoardData } from './types';

const POLL_MS = 5_000;

type LiveState = {
  data: BoardData | null;
  /** Last time the server answered (ms). */
  updatedAt: number | null;
  offline: boolean;
  /** The first load failed (nothing to show yet). */
  failed: boolean;
  /** Refetch now (after an admin save). */
  refresh: () => Promise<void>;
};

const LiveContext = createContext<LiveState | null>(null);

export function LiveProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<BoardData | null>(null);
  const [updatedAt, setUpdatedAt] = useState<number | null>(null);
  const [offline, setOffline] = useState(false);
  const [failed, setFailed] = useState(false);
  const version = useRef<number | null>(null);
  const busy = useRef(false);

  const load = useCallback(async () => {
    const d = await api.data();
    version.current = d.version;
    setData(d);
  }, []);

  /** Check the counter; fetch everything only if it moved. */
  const check = useCallback(
    async (force = false) => {
      if (busy.current) return;
      busy.current = true;
      try {
        const v = force ? null : await api.version();
        if (force || v !== version.current) await load();
        setUpdatedAt(Date.now());
        setOffline(false);
        setFailed(false);
      } catch {
        setOffline(true);
        setFailed((f) => f || version.current === null);
      } finally {
        busy.current = false;
      }
    },
    [load],
  );

  useEffect(() => {
    check(true);
    const tick = () => document.visibilityState === 'visible' && check();
    const id = setInterval(tick, POLL_MS);
    const onVisible = () => document.visibilityState === 'visible' && check(true);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('online', onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('online', onVisible);
    };
  }, [check]);

  const refresh = useCallback(() => check(true), [check]);
  const value = useMemo<LiveState>(() => ({ data, updatedAt, offline, failed, refresh }), [data, updatedAt, offline, failed, refresh]);
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

export function useLive() {
  const ctx = useContext(LiveContext);
  if (!ctx) throw new Error('useLive must be used inside LiveProvider');
  return ctx;
}

/** Current time (ms), ticking every `everyMs`. Honours the ?now=07:20 override. */
export function useNow(everyMs = 1_000) {
  const [offset] = useState(clockOffset);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(id);
  }, [everyMs]);
  return { now: now + offset, simulated: offset !== 0 };
}
