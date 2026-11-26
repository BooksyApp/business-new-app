import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, ApiError, clearSession, loadSession, saveSalon, saveSession, setSignedOutHandler, type AuthResponse, type Business } from '@/lib/api';
import { loadLocale } from '@/i18n';

type Status = 'boot' | 'offline' | 'out' | 'in';
type AppState = {
  status: Status;
  user: AuthResponse | null;
  salon: Business | null;
  salons: Business[];
  /** Bumped after any mutation so lists reload. */
  version: number;
  bump: () => void;
  retryBoot: () => void;
  signedIn: (u: AuthResponse, salons: Business[]) => Promise<void>;
  chooseSalon: (b: Business) => void;
  signOut: () => void;
};
const Ctx = createContext<AppState | null>(null);
export function useApp(): AppState {
  const v = useContext(Ctx);
  if (!v) throw new Error('AppProvider missing');
  return v;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<Status>('boot');
  const [user, setUser] = useState<AuthResponse | null>(null);
  const [salons, setSalons] = useState<Business[]>([]);
  const [salon, setSalon] = useState<Business | null>(null);
  const [version, setVersion] = useState(0);
  const [attempt, setAttempt] = useState(0);

  const out = useCallback(() => { setUser(null); setSalons([]); setSalon(null); setStatus('out'); }, []);

  useEffect(() => {
    setSignedOutHandler(out);
    return () => setSignedOutHandler(null);
  }, [out]);

  useEffect(() => {
    let alive = true;
    (async () => {
      await loadLocale();
      const s = await loadSession();
      if (!s.user) { if (alive) setStatus('out'); return; }
      try {
        const list = await api.salonsForUser(s.user);
        if (!alive) return;
        setUser(s.user); setSalons(list);
        setSalon(list.find((b) => b.id === s.salonId) ?? (list.length === 1 ? list[0] : null));
        setStatus('in');
      } catch (e) {
        if (!alive) return;
        // Offline keeps the tokens (retry); anything else (401 already cleared them) goes to login.
        setStatus(e instanceof ApiError && e.status === 0 ? 'offline' : 'out');
      }
    })();
    return () => { alive = false; };
  }, [attempt]);

  const value = useMemo<AppState>(() => ({
    status, user, salon, salons, version,
    bump: () => setVersion((v) => v + 1),
    retryBoot: () => { setStatus('boot'); setAttempt((n) => n + 1); },
    signedIn: async (u, list) => {
      await saveSession(u);
      setUser(u); setSalons(list); setSalon(list.length === 1 ? list[0] : null); setStatus('in');
    },
    chooseSalon: (b) => { setSalon(b); void saveSalon(b.id); setVersion((v) => v + 1); },
    signOut: () => { void api.logout().catch(() => undefined); void clearSession(); out(); },
  }), [status, user, salon, salons, version, out]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
