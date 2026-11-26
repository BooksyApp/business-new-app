/**
 * DEV ONLY. Loaded from app/_layout.tsx only when __DEV__ && EXPO_PUBLIC_MOCK=1.
 * Replaces global fetch with fixtures so every screen renders without the backend, and seeds a fake session.
 * Never ships: release builds have __DEV__ === false, so the require() is dead code.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

// Dev preview clock: pin "now" to 13:40 so the now-line, next-client hero and fixtures line up with the frames (BF01/BF02 show 13:40).
{
  const R = Date; const t0 = new R(); t0.setHours(13, 40, 0, 0); const off = t0.getTime() - R.now();
  class MockDate extends R { constructor(...a: unknown[]) { if (a.length === 0) super(R.now() + off); else super(...(a as [number])); } static now() { return R.now() + off; } }
  (globalThis as { Date: DateConstructor }).Date = MockDate as unknown as DateConstructor;
}
const IMG = process.env.EXPO_PUBLIC_MOCK_IMG || 'http://localhost:8762';
const ph = (n: string) => `${IMG}/${n}.jpg`;
const pad = (n: number) => String(n).padStart(2, '0');
const today = new Date();
const D = (off = 0) => { const d = new Date(today); d.setDate(d.getDate() + off); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const iso = (off = 0, h = 12) => `${D(off)}T${pad(h)}:00:00`;

const biz = { id: 'b1', name: 'Mirvari Beauty Lounge', currency: 'AZN', city: 'Bakı', address: 'Nizami küç. 42, Yasamal', phone: '+994 50 123 45 67', myRole: 'OWNER', logoUrl: ph('f01') };
const staff = [
  { id: 's1', name: 'Nigar', position: 'Saç ustası', avatarUrl: ph('f01'), isActive: true, role: 'STAFF', phone: '+994 50 111 22 33', email: 'nigar@mirvari.az' },
  { id: 's2', name: 'Aysel', position: 'Manikür ustası', avatarUrl: ph('f02'), isActive: true, role: 'STAFF', phone: '+994 55 222 33 44' },
  { id: 's3', name: 'Sabina', position: 'Kosmetoloq', avatarUrl: ph('f03'), isActive: true, role: 'MANAGER', phone: '+994 70 333 44 55' },
  { id: 's4', name: 'Günel', position: 'Makiyaj ustası', avatarUrl: ph('f04'), isActive: true, role: 'STAFF', phone: '+994 51 444 55 66' },
];
const cats = [
  { id: 'c1', name: 'Saç', isVisible: true, serviceCount: 3, color: '#6f52ed' },
  { id: 'c2', name: 'Dırnaq', isVisible: true, serviceCount: 2, color: '#e83e63' },
  { id: 'c3', name: 'Üz və bədən', isVisible: true, serviceCount: 2, color: '#ffa8bb' },
];
const svc = (id: string, name: string, categoryId: string, categoryName: string, price: number, durationMinutes: number) =>
  ({ id, name, categoryId, categoryName, price, durationMinutes, isActive: true, isVisible: true, priceType: 'FIXED', staffIds: ['s1', 's2', 's3'], description: 'Peşəkar xidmət, premium məhsullarla.' });
const services = [
  svc('v1', 'Boyama', 'c1', 'Saç', 120, 120), svc('v2', 'Qaş və kirpik', 'c3', 'Üz və bədən', 35, 45), svc('v3', 'Gel lak', 'c2', 'Dırnaq', 40, 60),
  svc('v4', 'Qadın saç kəsimi', 'c1', 'Saç', 45, 60), svc('v5', 'Üz baxımı', 'c3', 'Üz və bədən', 80, 75), svc('v6', 'Manikür', 'c2', 'Dırnaq', 30, 45), svc('v7', 'Fen və üslub', 'c1', 'Saç', 35, 45),
];
const names: [string, string, string][] = [['Nərmin', 'Həsənova', 'f02'], ['Fidan', 'Aliyeva', 'f03'], ['Sabina', 'Rüstəmova', 'f04'], ['Aynur', 'Tağıyeva', 'f01'], ['Ramin', 'Məmmədov', ''], ['Leyla', 'Quliyeva', 'f02'], ['Kamran', 'Əliyev', ''], ['Səbinə', 'İsmayılova', 'f03'], ['Aytən', 'Hüseynova', 'f04'], ['Gülnar', 'Abbasova', 'f01']];
const clientsAll = names.map(([f, l, p], i) => ({
  id: `k${i + 1}`, firstName: f, lastName: l, email: `${f.toLowerCase()}@mail.az`, phone: `+994 50 ${100 + i * 7} ${20 + i} ${40 + i}`, notes: i === 0 ? 'Sulfatsız şampun istəyir.' : null,
  totalVisits: 14 - i, pastVisits: 14 - i, totalSpent: 1240 - i * 90, lastVisitDate: D(-(i + 1) * 3), avatarUrl: p ? ph(p) : null, vip: i < 2, avgPrice: 62, favouriteService: services[i % 7].name, favouriteMaster: staff[i % 4].name,
  nextVisitDate: i < 3 ? D(i + 1) : null, nextVisitTime: '14:30', nextServiceName: 'Gel lak', noShowAppointments: i === 4 ? 2 : 0, cancelledAppointments: 1, createdAt: D(-200 + i * 9),
}));
const ap = (id: string, staffId: string, clientIdx: number, sv: number, start: string, end: string, status: string, extra: Record<string, unknown> = {}) => {
  const c = clientsAll[clientIdx]; const s = services[sv];
  return { id, businessId: 'b1', staffId, staffName: staff.find((x) => x.id === staffId)!.name, clientId: c.id, clientName: `${c.firstName} ${c.lastName[0]}.`, clientPhone: c.phone, serviceId: s.id, serviceName: s.name, appointmentDate: D(0), startTime: start, endTime: end, status, paymentStatus: null, price: s.price, bookingSource: 'web', ...extra };
};
const nm = new Date(); const r5 = (m: number) => Math.ceil(m / 5) * 5; const hm = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`; const n0 = Math.min(r5(nm.getHours() * 60 + nm.getMinutes() + 20), 14 * 60 + 30);
const appts = [
  ap('a1', 's1', 0, 2, hm(n0), hm(n0 + 75), 'CONFIRMED', { lateMinutes: 10 }), ap('a2', 's2', 1, 3, '09:30', '10:30', 'COMPLETED', { paymentStatus: 'PAID' }),
  ap('a3', 's1', 3, 0, '12:00', '14:00', 'CONFIRMED', { notes: 'Qızılı çalar' }), ap('a4', 's2', 2, 5, hm(n0 + 90), hm(n0 + 135), 'PENDING'),
  ap('a5', 's3', 5, 4, '10:30', '11:45', 'CONFIRMED'), ap('a6', 's2', 7, 2, '13:00', '14:00', 'CONFIRMED', { guestName: 'Qonaq' }),
  ap('a7', 's4', 8, 1, hm(n0 + 150), hm(n0 + 195), 'PENDING'), ap('a8', 's1', 9, 3, hm(n0 + 210), hm(n0 + 270), 'CONFIRMED'), ap('a9', 's3', 6, 6, '14:00', '14:45', 'CONFIRMED'),
  ap('a10', 's2', 4, 2, '16:00', '17:00', 'NO_SHOW'), ap('a11', 's4', 0, 1, '11:30', '12:15', 'CONFIRMED'),
];
const sales = [
  { id: 1, clientName: 'Nərmin H.', staffName: 'Nigar', saleDate: D(0), saleTime: '11:05', total: 40, tipAmount: 5, paymentMethod: 'CARD_TERMINAL', items: [{ name: 'Gel lak' }] },
  { id: 2, clientName: 'Fidan A.', staffName: 'Aysel', saleDate: D(0), saleTime: '10:40', total: 45, tipAmount: 0, paymentMethod: 'CASH', items: [{ name: 'Saç kəsimi' }] },
  { id: 3, clientName: 'Aynur T.', staffName: 'Sabina', saleDate: D(0), saleTime: '09:55', total: 80, tipAmount: 10, paymentMethod: 'CARD_TERMINAL', items: [{ name: 'Üz baxımı' }] },
];
const convs = [
  { conversationId: 'm1', customerName: 'Nərmin Həsənova', customerEmail: 'n@mail.az', unread: 2, lastMessageAt: iso(0, 9) },
  { conversationId: 'm2', customerName: 'Fidan Aliyeva', customerEmail: 'f@mail.az', unread: 0, lastMessageAt: iso(-1, 18) },
  { conversationId: 'm3', customerName: 'Kamran Əliyev', customerEmail: 'k@mail.az', unread: 0, lastMessageAt: iso(-3, 12) },
];
const inbox = { unread: 3, items: [
  { id: 1, type: 'BOOKING_NEW', title: 'Yeni rezerv', body: 'Nərmin H. · Gel lak · bu gün 14:30', data: null, createdAt: iso(0, 9), readAt: null },
  { id: 2, type: 'BOOKING_CANCELLED', title: 'Rezerv ləğv edildi', body: 'Ramin M. · Manikür · sabah 11:00', data: null, createdAt: iso(0, 8), readAt: null },
  { id: 3, type: 'REVIEW_NEW', title: 'Yeni rəy 5 ★', body: '“Nigar əla işləyir, təşəkkürlər!”', data: null, createdAt: iso(-1, 20), readAt: null },
  { id: 4, type: 'STOCK_LOW', title: 'Anbar azalır', body: 'Gel lak bazası: 2 ədəd qalıb', data: null, createdAt: iso(-2, 10), readAt: iso(-2, 11) },
] };
const reviews = [
  { id: 1, rating: 5, comment: 'Nigar əla işləyir, təşəkkürlər! Rəng tam istədiyim kimi oldu.', createdAt: iso(-1, 20), authorName: 'Leyla Q.', reply: null, repliedAt: null, serviceName: 'Boyama', staffName: 'Nigar' },
  { id: 2, rating: 4, comment: 'Çox təmiz və sakit məkan.', createdAt: iso(-4, 12), authorName: 'Aytən H.', reply: 'Təşəkkür edirik!', repliedAt: iso(-3, 9), serviceName: 'Gel lak', staffName: 'Aysel' },
];
const dash = { kpis: { revenue: { value: 4820, previous: 4100 }, bookings: { value: 126, previous: 110 }, newClients: { value: 24, previous: 19 }, avgTicket: { value: 58, previous: 55 } }, topServices: [{ name: 'Gel lak', bookings: 38, revenue: 1520 }, { name: 'Boyama', bookings: 21, revenue: 2520 }], staff: [{ name: 'Nigar', visits: 44, revenue: 2100, utilization: 0.82 }, { name: 'Aysel', visits: 39, revenue: 1500, utilization: 0.74 }], sources: [{ source: 'web', bookings: 70 }, { source: 'manual', bookings: 56 }] };
const hours = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map((d, i) => ({ dayOfWeek: d, enabled: i < 6, startTime: '09:00', endTime: '19:00' }));
const notif = { emailConfirmation: true, emailReminder: true, emailCancellation: true, emailReschedule: true, emailWaitlist: false, emailReviewRequest: true, salonAlerts: true, reminderHoursBefore: 24, smsEnabled: false, pushEnabled: true, smsAvailable: true, pushAvailable: true, senderName: 'Mirvari', replyTo: null };
const prefs = { types: ['BOOKING_NEW', 'BOOKING_CANCELLED', 'BOOKING_RESCHEDULED', 'REVIEW_NEW', 'STOCK_LOW', 'WAITLIST', 'PAYMENT'], pushOff: ['STOCK_LOW'], inboxOff: [], emailOff: [], quietStart: '22:00', quietEnd: '08:00', staff: [], stockThreshold: 5 };

type Hit = (m: string, path: string, q: URLSearchParams, body: any) => unknown | undefined;
const routes: [RegExp, Hit | unknown][] = [
  [/^\/public\/auth\/login/, { accessToken: 'mock', refreshToken: 'mock', userId: 'u1', fullName: 'Leyla Məmmədova', email: 'leyla@mirvari.az', role: 'BUSINESS_OWNER', businessId: null }],
  [/^\/businesses\/owner\//, [biz, { ...biz, id: 'b2', name: 'Mirvari Studio Nərimanov', address: 'Təbriz küç. 8', logoUrl: ph('f03') }]],
  [/^\/bookings\/business\/[^/]+\/clients/, clientsAll],
  [/^\/bookings\/business\/[^/]+\/slot-discounts/, []],
  [/^\/bookings\/business\//, (_m: string, _p: string, q: URLSearchParams) => { const a = q.get('startDate'); const b = q.get('endDate'); return appts.map((x) => ({ ...x, appointmentDate: a && b && a !== b ? D(Math.floor((new Date(x.appointmentDate).getTime() - today.getTime()) / 864e5) + (Number(x.id.slice(1)) % 5) - 2) : x.appointmentDate })); }],
  [/^\/bookings\/[^/]+$/, (_m: string, p: string) => appts.find((a) => a.id === p.split('/').pop()) ?? appts[0]],
  [/^\/staff\/business\//, staff],
  [/^\/categories\/business\//, cats],
  [/^\/services\/business\/[^/]+\/archived/, []],
  [/^\/services\/business\//, services],
  [/^\/time-off\/business\/[^/]+\/date/, [{ id: 't1', staffId: 's2', startDate: D(0), endDate: D(0), startTime: '14:00', endTime: '15:00', isFullDay: false, reason: 'Nahar' }]],
  [/^\/sales\/business\//, sales],
  [/^\/businesses\/[^/]+\/messages\/conversations\/[^/]+/, { conversationId: 'm1', customerName: 'Nərmin Həsənova', customerEmail: 'n@mail.az', messages: [
    { messageId: 'x1', fromSalon: false, body: 'Salam, sabaha vaxtı bir saat sonraya keçirmək olarmı?', sentAt: iso(0, 8) },
    { messageId: 'x2', fromSalon: true, body: 'Salam Nərmin! Əlbəttə, 15:30 uyğundur.', sentAt: iso(0, 8) },
    { messageId: 'x3', fromSalon: false, body: 'Təşəkkürlər, görüşənədək', sentAt: iso(0, 9) }] }],
  [/^\/businesses\/[^/]+\/messages\/conversations$/, convs],
  [/^\/clients\/business\//, clientsAll],
  [/^\/businesses\/[^/]+\/clients\/[^/]+\/record/, { notes: [{ id: 1, kind: 'NOTE', body: 'Sulfatsız şampun istəyir.', pinned: true, author_name: 'Sabina', created_at: iso(-10) }], visits: clientsAll.slice(0, 4).map((c, i) => ({ id: i, appointment_date: D(-7 * (i + 1)), start_time: '12:00', service_name: services[i].name, price: services[i].price, status: 'COMPLETED', staff_name: staff[i % 4].name })) }],
  [/^\/waitlist\/business\//, [{ id: 'w1', clientName: 'Rəna Q.', clientPhone: '+994 50 000 00 00', preferredDate: D(1), status: 'WAITING', serviceName: 'Gel lak', staffName: 'Aysel' }]],
  [/^\/businesses\/[^/]+\/day-sheet/, { date: D(0), totals: { bookings: 11, expected: 640, already_paid: 120 } }],
  [/^\/reviews\/business\/[^/]+\/summary/, { count: 128, average: 4.8 }],
  [/^\/reviews\/business\//, reviews],
  [/^\/analytics\/business\//, dash],
  [/^\/business-hours-exceptions/, []],
  [/^\/business-hours\//, hours],
  [/^\/notifications\/inbox\/unread-count/, { unread: 3 }],
  [/^\/notifications\/inbox/, inbox],
  [/^\/notifications\/preferences/, prefs],
  [/^\/businesses\/[^/]+\/hub-events/, { unread: 2, events: [] }],
  [/^\/businesses\/[^/]+\/notification-settings/, notif],
  [/^\/businesses\/[^/]+\/subscription/, { plan: 'PRO', status: 'ACTIVE', trialEndsAt: null, currentPeriodEnd: iso(20) }],
  [/^\/businesses\/[^/]+\/looks/, [{ id: 1, photoUrl: ph('p7755183'), title: 'Balayage', serviceName: 'Boyama', status: 'PUBLISHED' }, { id: 2, photoUrl: ph('p7755209'), title: 'French', serviceName: 'Gel lak', status: 'PUBLISHED' }]],
  [/^\/businesses\/[^/]+\/stories/, []],
  [/^\/businesses\/[^/]+\/tips/, { totals: { total: 120, outstanding: 40, cash: 50, card: 70, lines: 12 }, byStaff: [{ staff_name: 'Nigar', earned: 60, outstanding: 20 }] }],
  [/^\/businesses\/b[^/]*$/, biz],
  [/^\/products\/business\//, [{ id: 1, name: 'Gel lak bazası', sku: 'GL-1', price: 12, quantityOnHand: 2, lowStockThreshold: 5, isActive: true, lowStock: true }, { id: 2, name: 'Şampun 500ml', sku: 'SH-5', price: 24, quantityOnHand: 14, lowStockThreshold: 4, isActive: true, lowStock: false }]],
  [/profit-and-loss/, { months: [{ month: '2026-11', revenue: 4820, expenses: 1240, wages: 1480, profit: 2100 }, { month: '2026-10', revenue: 4100, expenses: 1180, wages: 1400, profit: 1520 }], totals: { revenue: 8920, expenses: 2420, wages: 2880, profit: 3620 } }],
  [/\/tax/, { totals: { count: 120, net: 4090, tax: 730, gross: 4820 }, byRate: [{ rate: 18, net: 4090, tax: 730 }] }],
  [/\/cash-drawer/, null],
  [/^\/team-permissions/, []],
  [/^\/quick-sale/, []],
];

export function install() {
  const real = globalThis.fetch;
  const ok = (data: unknown) => new Response(JSON.stringify(data), { status: 200, headers: { 'Content-Type': 'application/json' } });
  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : (input as Request).url;
    const m = url.match(/\/api(\/[^?]*)(\?.*)?$/);
    if (!m) return real(input as any, init);
    await new Promise((r) => setTimeout(r, /^\/(businesses\/owner|public\/auth|auth)/.test(m[1]) ? 60 : MOCK_DELAY));
    const path = m[1]; const q = new URLSearchParams(m[2] ?? ''); const method = (init?.method ?? 'GET').toUpperCase();
    if (path === '/auth/refresh') return ok({ accessToken: 'mock', refreshToken: 'mock' });
    if (MODE === 'error' && method === 'GET' && !/^\/(businesses\/owner|notifications)/.test(path)) return new Response(JSON.stringify({ message: 'Server cavab vermir' }), { status: 500 });
    if (MODE === 'empty' && method === 'GET' && !/^\/(businesses\/owner|notifications|business-hours|staff\/business|categories)/.test(path)) return ok(/day-sheet|summary|dashboard/.test(path) ? { date: D(0), totals: { bookings: 0, expected: 0, already_paid: 0 }, count: 0, average: null, kpis: {}, topServices: [], staff: [], sources: [] } : []);
    if (MOCK_ERROR && path.startsWith(MOCK_ERROR)) return new Response(JSON.stringify({ message: 'Server xətası' }), { status: 500 });
    if (method !== 'GET' && !path.startsWith('/public/auth/login')) return ok({});
    for (const [re, h] of routes) if (re.test(path)) return ok(typeof h === 'function' ? (h as Hit)(method, path, q, null) : h);
    return ok([]);
  }) as typeof fetch;
  // fake session so the app boots straight into the calendar (?signedout=1 keeps the login screen)
  const hash = typeof location !== 'undefined' ? location.search : '';
  const out = /signedout/.test(hash);
  void (async () => {
    if (out) { await AsyncStorage.clear(); return; }
    const user = { accessToken: '', refreshToken: '', userId: 'u1', fullName: 'Leyla Məmmədova', email: 'leyla@mirvari.az', role: 'BUSINESS_OWNER', businessId: null };
    const salon = /salon=0/.test(hash) ? null : 'b1';
    for (const [k, v] of Object.entries({ 'biz.access': 'mock', 'biz.refresh': 'mock', 'biz.user': JSON.stringify(user), ...(salon ? { 'biz.salon': salon } : {}) })) await AsyncStorage.setItem(k, v);
  })();
}
const MODE = typeof location !== 'undefined' ? (/mock=(\w+)/.exec(location.search)?.[1] ?? '') : '';
let MOCK_DELAY = MODE === 'slow' ? 30000 : 120;
let MOCK_ERROR = '';
export const mockSeed = { biz, staff, user: { accessToken: '', refreshToken: '', userId: 'u1', fullName: 'Leyla Məmmədova', email: 'leyla@mirvari.az', role: 'BUSINESS_OWNER', businessId: null } };
export const setMock = (o: { delay?: number; error?: string }) => { if (o.delay != null) MOCK_DELAY = o.delay; if (o.error != null) MOCK_ERROR = o.error; };
