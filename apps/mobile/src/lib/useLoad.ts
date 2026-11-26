import { useCallback, useEffect, useRef, useState } from 'react';

/** Loads once per `deps` change; `reload` for pull-to-refresh. Keeps stale data while refreshing. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const alive = useRef(true);
  const seq = useRef(0);
  const fnRef = useRef(fn);
  useEffect(() => {
    fnRef.current = fn;
  });

  const run = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    const mine = ++seq.current; // only the newest request may write state (slow older answers are dropped)
    try {
      const d = await fnRef.current();
      if (alive.current && mine === seq.current) {
        setData(d);
        setError(null);
      }
    } catch (e) {
      if (alive.current && mine === seq.current) setError(e as Error);
    } finally {
      if (alive.current && mine === seq.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void run(false);
    return () => {
      alive.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const reload = useCallback(() => run(true), [run]);
  return { data, error, loading, refreshing, reload };
}
