/**
 * Demo mode: "Demo-ya bax" on the sign-in screen opens a sample salon (fixtures.ts) in RELEASE builds too.
 * While it is on, every request to `${API_BASE}/api/...` is answered locally: reads from the fixtures, writes become
 * no-ops with the toast "Demo rejimində yadda saxlanmır". Nothing reaches the server and nothing is persisted:
 * a cold start always comes back to sign-in. The dev visual-QA layer (EXPO_PUBLIC_MOCK=1) reuses the same engine.
 */
import { t as tr } from '@/i18n';
import { toast } from '@/lib/toast';
import { liveHit } from './live';
import { buildDemo, type Hit, type Route } from './fixtures';

let on = false;
let routes: Route[] = [];
let mode: '' | 'empty' | 'error' | 'slow' | 'live' = '';
let lastToast = 0;
const subs = new Set<(v: boolean) => void>();

export const isDemo = () => on;
export const subscribeDemo = (f: (v: boolean) => void) => { subs.add(f); return () => { subs.delete(f); }; };
/** Dev only: ?mock=empty|error|slow in the web preview. */
export const setDemoVariant = (m: typeof mode) => { mode = m; };

export function enterDemo() {
  const d = buildDemo();
  routes = d.routes; on = true;
  subs.forEach((f) => f(true));
  return d;
}
export function exitDemo() { on = false; routes = []; subs.forEach((f) => f(false)); }

const ok = (data: unknown) => new Response(JSON.stringify(data ?? null), { status: 200, headers: { 'Content-Type': 'application/json' } });
const EMPTY_KEEP = /^\/(businesses\/owner|public\/auth|notifications\/preferences|business-hours|staff\/business|categories)/;

let installed = false;
/** Wraps global fetch once at startup; a pass-through unless demo mode is on. */
export function installDemoFetch() {
  if (installed) return; installed = true;
  const real = globalThis.fetch.bind(globalThis);
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!on) return real(input as RequestInfo, init);
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    const m = url.match(/\/api(\/[^?]*)(\?.*)?$/);
    if (!m) return real(input as RequestInfo, init);
    const path = m[1]; const q = new URLSearchParams(m[2] ?? ''); const method = (init?.method ?? 'GET').toUpperCase();
    await new Promise((r) => setTimeout(r, mode === 'slow' ? 30000 : 90));
    if (path === '/auth/refresh') return ok({ accessToken: 'demo', refreshToken: 'demo' });
    if (path === '/auth/logout') return ok({});
    if (mode === 'error' && method === 'GET' && !/^\/(businesses\/owner|notifications)/.test(path)) return new Response(JSON.stringify({ message: 'Server cavab vermir' }), { status: 500 });
    if (method !== 'GET' && !path.startsWith('/public/auth')) {
      // Writes are no-ops. One toast per burst (a screen may fire several calls for one tap).
      if (!/device-tokens|inbox\/read|\/seen|\/views/.test(path) && Date.now() - lastToast > 1500) { lastToast = Date.now(); toast(tr('v2.demoNoSave'), 'info'); }
      if (/\/import(\/preview)?$/.test(path)) { const r = routes.find(([re]) => re.test('/import/preview')); return ok(r ? r[1] : {}); }
      return ok({});
    }
    if (mode === 'empty' && /\/readiness$/.test(path)) return ok({ bookable: false, missing: ['services', 'staff', 'onlineBooking'], recommended: ['photos'] });
    if (mode === 'empty' && !EMPTY_KEEP.test(path)) {
      return ok(/day-sheet|summary|dashboard|unread/.test(path) ? { date: '', totals: { bookings: 0, expected: 0, already_paid: 0 }, count: 0, average: null, unread: 0, kpis: {}, topServices: [], staff: [], sources: [] } : []);
    }
    if (mode === 'live') { const hit = liveHit(method, path); if (hit) return hit; }
    for (const [re, h] of routes) if (re.test(path)) return ok(typeof h === 'function' ? (h as Hit)(method, path, q, null) : h);
    return ok([]);
  }) as typeof fetch;
}
