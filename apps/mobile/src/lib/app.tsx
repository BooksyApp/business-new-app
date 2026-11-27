import { AppState as RNAppState } from 'react-native';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { api, ApiError, clearSession, loadSession, saveSalon, saveSession, setSignedOutHandler, type AuthResponse, type Business } from '@/lib/api';
import { loadLocale } from '@/i18n';
import { setSalonZone } from '@/lib/salonClock';
import { apiB } from '@/lib/api-biz';
import { useOnline } from '@/lib/net';
import { registerIfGranted, unregisterPush } from '@/lib/push';
import { enterDemo as startDemo, exitDemo as stopDemo, isDemo } from '@/demo';

type Status = 'boot' | 'offline' | 'out' | 'in';
type AppState = {
  status: Status;
  user: AuthResponse | null;
  salon: Business | null;
  salons: Business[];
  /** Bumped after any mutation so lists reload. */
  version: number;
  /** Tab badges: bookings waiting for confirmation (next 30 days) and open waitlist requests. */
  badges: { pending: number; waitlist: number; inbox: number };
  bump: () => void;
  retryBoot: () => void;
  signedIn: (u: AuthResponse, salons: Business[]) => Promise<void>;
  chooseSalon: (b: Business) => void;
  signOut: () => void;
  /** Demo mode: a sample salon served locally, nothing saved (src/demo). */
  demo: boolean;
  enterDemo: () => void;
  exitDemo: () => void;
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
  const [badges, setBadges] = useState({ pending: 0, waitlist: 0, inbox: 0 });
  const [demo, setDemo] = useState(false);

  const out = useCallback(() => { if (isDemo()) { stopDemo(); setDemo(false); } setUser(null); setSalons([]); setSalon(null); setStatus('out'); }, []);
  const demoIn = useCallback(() => {
    const d = startDemo();
    const b = d.biz as unknown as Business;
    setDemo(true); setUser(d.user as unknown as AuthResponse); setSalons([b]); setSalon(b); setVersion((v) => v + 1); setStatus('in');
  }, []);

  useEffect(() => {
    setSignedOutHandler(out);
    return () => setSignedOutHandler(null);
  }, [out]);

  useEffect(() => {
    let alive = true;
    // Boot never hangs: after 6s without an answer we fall back to the login screen.
    const guard = setTimeout(() => { if (alive) setStatus((c) => (c === 'boot' ? 'out' : c)); }, 6000);
    (async () => {
      try { await loadLocale(); } catch { /* default locale */ }
      // Dev visual QA (EXPO_PUBLIC_MOCK=1) boots straight into the demo salon.
      if (__DEV__ && (globalThis as { __BOOQI_AUTODEMO__?: boolean }).__BOOQI_AUTODEMO__) { if (alive) demoIn(); return; }
      let s: Awaited<ReturnType<typeof loadSession>>;
      try { s = await loadSession(); } catch { if (alive) setStatus('out'); return; }
      if (!s.user) { if (alive) setStatus('out'); return; }
      try {
        const list = await api.salonsForUser(s.user);
        if (!alive) return;
        setUser(s.user); setSalons(list);
        const picked = list.find((b) => b.id === s.salonId) ?? (list.length === 1 ? list[0] : null);
        setSalonZone((picked as { timezone?: string } | null)?.timezone);   // the salon's clock for "now"
        setSalon(picked);
        setStatus('in');
      } catch (e) {
        if (!alive) return;
        // Offline keeps the tokens (retry); anything else (401 already cleared them) goes to login.
        setStatus(e instanceof ApiError && e.status === 0 ? 'offline' : 'out');
      }
    })().catch(() => { if (alive) setStatus((c) => (c === 'boot' ? 'out' : c)); });
    return () => { alive = false; clearTimeout(guard); };
  }, [attempt]);

  // Tab badges follow the salon and every mutation; failures keep the previous numbers.
  useEffect(() => {
    if (status !== 'in' || !salon) { setBadges({ pending: 0, waitlist: 0, inbox: 0 }); return; }
    let alive = true;
    const today = new Date();
    const end = new Date(today); end.setDate(end.getDate() + 30);
    void Promise.all([api.appointments(salon.id, today, end).catch(() => null), api.waitlist(salon.id).catch(() => null), apiB.inboxUnread().catch(() => null)]).then(([a, w, ib]) => {
      if (!alive) return;
      setBadges((b) => ({
        inbox: ib ? ib.unread : b.inbox,
        pending: a ? a.filter((x) => x.status === 'PENDING').length : b.pending,
        waitlist: w ? w.filter((x) => (x.status ?? '').toUpperCase() === 'WAITING' || (x.status ?? '').toUpperCase() === 'ACTIVE').length : b.waitlist,
      }));
    });
    return () => { alive = false; };
  }, [status, salon?.id, version]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fresh data when the app returns to the foreground (after >30s away) and when the connection comes back.
  const online = useOnline();
  const wasOnline = useRef(true);
  useEffect(() => {
    if (online && !wasOnline.current && status === 'in') setVersion((v) => v + 1);
    wasOnline.current = online;
  }, [online, status]);
  useEffect(() => {
    let left = 0;
    const sub = RNAppState.addEventListener('change', (s) => {
      if (s === 'background') left = Date.now();
      else if (s === 'active' && left && Date.now() - left > 30000 && status === 'in') { left = 0; setVersion((v) => v + 1); }
    });
    return () => sub.remove();
  }, [status]);

  // A device that already granted notification permission keeps its push token fresh without asking again.
  useEffect(() => { if (status === 'in' && user?.userId && !isDemo()) void registerIfGranted(user.userId); }, [status, user?.userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const value = useMemo<AppState>(() => ({
    status, user, salon, salons, version, badges,
    bump: () => setVersion((v) => v + 1),
    retryBoot: () => { setStatus('boot'); setAttempt((n) => n + 1); },
    signedIn: async (u, list) => {
      await saveSession(u);
      setUser(u); setSalons(list); setSalon(list.length === 1 ? list[0] : null); setStatus('in');
    },
    chooseSalon: (b) => { setSalon(b); if (!isDemo()) void saveSalon(b.id); setVersion((v) => v + 1); },
    signOut: () => { if (isDemo()) { out(); return; } void unregisterPush().finally(() => { void api.logout().catch(() => undefined); void clearSession(); }); out(); },
    demo, enterDemo: demoIn, exitDemo: out,
  }), [status, user, salon, salons, version, badges, out, demo, demoIn]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
