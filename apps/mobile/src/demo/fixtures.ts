/**
 * Demo salon fixtures (Mirvari Beauty Lounge), shaped like the real API responses so every screen renders through the same
 * services and hooks. Sample data from the approved artifact (artifacts/business-mobile-v2): 5 specialists, 10 clients,
 * 8 bookings today, stories, looks, reviews, KPIs. Photos are bundled ("demo:<key>", see demo/photos.ts).
 * Built fresh on every demo start so "today" and the next-client times follow the device clock.
 */
export type Hit = (m: string, path: string, q: URLSearchParams, body: unknown) => unknown;
export type Route = [RegExp, Hit | unknown];

export function buildDemo(): { routes: Route[]; user: Record<string, unknown>; biz: Record<string, unknown> } {
  const ph = (n: string) => `demo:${n}`;
  const pad = (n: number) => String(n).padStart(2, '0');
  const today = new Date();
  const D = (off = 0) => { const d = new Date(today); d.setDate(d.getDate() + off); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const iso = (off = 0, h = 12) => `${D(off)}T${pad(h)}:00:00`;
  const hm = (m: number) => `${pad(Math.floor(m / 60) % 24)}:${pad(m % 60)}`;
  const toM = (s: string) => { const [h, m] = s.split(':').map(Number); return h * 60 + m; };
  // Shift the artifact's day (next client 10:30 at 10:12) so the next client is ~18 min away now, kept inside the day.
  const nowMin = today.getHours() * 60 + today.getMinutes();
  const shift = Math.max(-570 + 480, Math.min(1430 - 1120, Math.round((nowMin + 18 - 630) / 5) * 5));
  const T = (s: string) => hm(toM(s) + shift);

  const biz = { id: 'demo-mirvari', name: 'Mirvari Beauty Lounge', currency: 'AZN', city: 'Bakı', address: 'Nizami küç. 52', phone: '+994 50 123 45 67', myRole: 'OWNER', logoUrl: ph('a-salon'), coverUrl: ph('f01'), slug: 'mirvari' };
  const S = (id: string, name: string, position: string, img: string, rating: number, load: number) => ({ id, name, position, avatarUrl: ph(img), isActive: true, role: 'STAFF', phone: '+994 50 111 22 33', rating, load });
  const staff = [
    S('aysel', 'Aysel Quliyeva', 'Stilist', 'a-aysel', 4.9, 0.75), S('nigar', 'Nigar Səfərova', 'Manikür ustası', 'a-nigar', 4.8, 0.5),
    S('lale', 'Lalə Kərimli', 'Kirpik və qaş', 'a-lale', 5.0, 0.88), S('kamran', 'Kamran Əliyev', 'Barber', 'a-kamran', 4.9, 0.62), S('rena', 'Rəna Hüseynova', 'Vizajist', 'a-rena', 4.9, 0.38),
  ];
  const cats = [
    { id: 'c-hair', name: 'Saç', isVisible: true, serviceCount: 2, color: '#6f52ed' }, { id: 'c-nail', name: 'Dırnaq', isVisible: true, serviceCount: 2, color: '#e83e63' },
    { id: 'c-lash', name: 'Kirpik', isVisible: true, serviceCount: 1, color: '#ffa8bb' }, { id: 'c-brow', name: 'Qaş', isVisible: true, serviceCount: 1, color: '#ffd2a1' },
    { id: 'c-barber', name: 'Barber', isVisible: true, serviceCount: 2, color: '#12704b' }, { id: 'c-mk', name: 'Makiyaj', isVisible: true, serviceCount: 1, color: '#5b3fd6' },
  ];
  const sv = (id: string, name: string, cat: string, price: number, durationMinutes: number, img: string, staffIds: string[]) =>
    ({ id, name, categoryId: `c-${cat}`, categoryName: cats.find((c) => c.id === `c-${cat}`)!.name, price, durationMinutes, isActive: true, isVisible: true, priceType: 'FIXED', staffIds, imageUrl: ph(img), description: 'Peşəkar xidmət, premium məhsullarla.' });
  const services = [
    sv('cut', 'Qadın saç kəsimi', 'hair', 35, 45, 'p7755225', ['aysel']), sv('blow', 'Saç yuma və fen', 'hair', 25, 40, 'p7755461', ['aysel']),
    sv('gel', 'Gel-lak manikür', 'nail', 30, 60, 'p3997381', ['nigar']), sv('art', 'Dırnaq dizaynı', 'nail', 45, 75, 'p7755211', ['nigar']),
    sv('lash', 'Kirpik artırma 2D', 'lash', 60, 90, 'p7755531', ['lale']), sv('brow', 'Qaş laminasiyası', 'brow', 30, 45, 'p8558246', ['lale']),
    sv('men', 'Saç + saqqal', 'barber', 25, 40, 'p3998417', ['kamran']), sv('mencut', 'Kişi saç kəsimi', 'barber', 20, 40, 'p7447142', ['kamran']),
    sv('mk', 'Gün makiyajı', 'mk', 70, 60, 'f04', ['rena']),
  ];
  const C = (id: string, first: string, last: string, img: string, cover: string, tags: string[], lastDays: number | null, v: number, spent: number, phone: string, since?: string) => ({
    id, firstName: first, lastName: last, email: `${id}@mail.az`, phone, notes: id === 'nermin' ? 'Lateks yapışqana həssasdır. Hipoallergen yapışqan istifadə edin.' : null,
    totalVisits: v, pastVisits: v, totalSpent: spent, lastVisitDate: lastDays == null ? null : D(-lastDays), avatarUrl: ph(img), coverUrl: ph(cover), vip: tags.includes('VIP'), tags,
    avgPrice: v ? Math.round(spent / v) : null, favouriteService: 'Saç yuma və fen', favouriteMaster: 'Aysel', createdAt: since ?? D(-200), noShowAppointments: 0, cancelledAppointments: 0,
  });
  const clientsAll = [
    C('leyla', 'Leyla', 'Həsənova', 'a-leyla', 'p7755215', ['VIP', 'Daimi'], 0, 14, 1240, '+994 50 412 18 07', '2025-03-04'),
    C('nermin', 'Nərmin', 'Quliyeva', 'a-nermin', 'p7755520', ['Daimi'], 12, 9, 610, '+994 55 208 44 19'),
    C('tural', 'Tural', 'Abbasov', 'a-tural', 'p7781852', ['Daimi'], 21, 11, 275, '+994 70 310 22 41'),
    C('ayten', 'Aytən', 'Məmmədli', 'a-ayten', 'p7755183', ['VIP'], 30, 21, 2180, '+994 51 700 18 30'),
    C('gunel', 'Günel', 'Əliyeva', 'a-gunel', 'f03', ['Yeni'], null, 0, 0, '+994 50 991 02 11', D(-2)),
    C('fidan', 'Fidan', 'Rzayeva', 'a-fidan', 'p7510147', [], 60, 4, 320, '+994 55 640 77 03'),
    C('gunay', 'Günay', 'Səfərli', 'a-sebine', 'p5938286', ['Yeni'], null, 0, 0, '+994 77 318 50 62', D(-1)),
    C('elvin', 'Elvin', 'Hüseynov', 'a-elvin', 'p7447142', [], 35, 6, 130, '+994 50 222 61 90'),
    C('zerife', 'Zərifə', 'Abbasova', 'a-zerife', 'f05', ['Qayıtmır'], 120, 7, 540, '+994 55 870 13 26'),
    C('ramin', 'Ramin', 'Nəsirov', 'a-ramin', 'p3998417', [], 14, 3, 75, '+994 70 455 09 81'),
  ];
  const cl = (id: string) => clientsAll.find((c) => c.id === id)!;
  let seq = 0;
  const ap = (date: string, start: string, end: string, client: string, service: string, st: string, status: string, extra: Record<string, unknown> = {}) => {
    const c = cl(client); const s = services.find((x) => x.id === service)!; const m = staff.find((x) => x.id === st)!;
    return { id: `bk${++seq}`, businessId: biz.id, staffId: m.id, staffName: m.name, clientId: c.id, clientName: `${c.firstName} ${c.lastName}`, clientPhone: c.phone, serviceId: s.id, serviceName: s.name,
      appointmentDate: date, startTime: start, endTime: end, status, paymentStatus: status === 'COMPLETED' ? 'PAID' : null, price: s.price, bookingSource: status === 'PENDING' ? 'web' : 'manual', ...extra };
  };
  // Today, exactly the artifact's day (B[]), shifted to the device clock.
  const day0 = [
    ap(D(0), T('09:30'), T('10:10'), 'leyla', 'blow', 'aysel', 'COMPLETED'),
    ap(D(0), T('10:30'), T('12:00'), 'nermin', 'lash', 'lale', 'CONFIRMED', { notes: 'Lateks yapışqana həssasdır. Hipoallergen yapışqan istifadə edin.' }),
    ap(D(0), T('11:00'), T('11:40'), 'tural', 'men', 'kamran', 'CONFIRMED'),
    ap(D(0), T('12:00'), T('13:00'), 'gunel', 'gel', 'nigar', 'PENDING'),
    ap(D(0), T('13:30'), T('14:30'), 'fidan', 'mk', 'rena', 'CONFIRMED'),
    ap(D(0), T('15:00'), T('15:45'), 'ayten', 'cut', 'aysel', 'CONFIRMED'),
    ap(D(0), T('16:30'), T('17:15'), 'gunay', 'brow', 'lale', 'PENDING'),
    ap(D(0), T('18:00'), T('18:40'), 'elvin', 'mencut', 'kamran', 'CONFIRMED'),
  ];
  // Other days: a deterministic, believable spread (Sundays closed) for the week strip, month dots and the KPI sparklines.
  const other: ReturnType<typeof ap>[] = [];
  const pool: [string, string, number][] = [['aysel', 'cut', 45], ['aysel', 'blow', 40], ['nigar', 'gel', 60], ['nigar', 'art', 75], ['lale', 'lash', 90], ['lale', 'brow', 45], ['kamran', 'men', 40], ['kamran', 'mencut', 40], ['rena', 'mk', 60]];
  const ids = clientsAll.map((c) => c.id);
  const md = (a: number, n: number) => ((a % n) + n) % n;
  for (let off = -35; off <= 35; off++) {
    if (off === 0) continue;
    const d = new Date(today); d.setDate(d.getDate() + off); if (d.getDay() === 0) continue;
    const n = 3 + md(off * 7, 5) + (off < 0 ? 2 : 0) - (off > 7 ? 3 : 0);
    for (let k = 0; k < Math.max(0, n); k++) {
      const [st, s, len] = pool[md(off * 3 + k * 5, pool.length)]; const start = 540 + md(k * 97 + off * 31, 9) * 60;
      const status = off < 0 ? (md(k + off, 11) === 0 ? 'NO_SHOW' : 'COMPLETED') : 'CONFIRMED';
      other.push(ap(D(off), hm(start), hm(start + len), ids[md(k * 3 + off, ids.length)], s, st, status));
    }
  }
  const appts = [...day0, ...other];
  const sales = [
    { id: 1, clientName: 'Leyla Həsənova', staffName: 'Aysel', saleDate: D(0), saleTime: T('10:12'), total: 25, tipAmount: 5, paymentMethod: 'CARD_TERMINAL', items: [{ name: 'Saç yuma və fen' }] },
    { id: 2, clientName: 'Ramin Nəsirov', staffName: 'Kamran', saleDate: D(-1), saleTime: '17:40', total: 25, tipAmount: 0, paymentMethod: 'CASH', items: [{ name: 'Saç + saqqal' }] },
  ];
  const convs = [
    { conversationId: 'm1', customerName: 'Nərmin Quliyeva', customerEmail: 'nermin@mail.az', unread: 1, lastMessageAt: iso(0, 9) },
    { conversationId: 'm2', customerName: 'Aytən Məmmədli', customerEmail: 'ayten@mail.az', unread: 0, lastMessageAt: iso(-1, 18) },
  ];
  const inbox = { unread: 3, items: [
    { id: 1, type: 'BOOKING_NEW', title: 'Günel Əliyeva onlayn rezerv etdi', body: `Gel-lak manikür, ${T('12:00')} · Nigar`, data: { bookingId: day0[3].id }, createdAt: iso(0, 10), readAt: null },
    { id: 2, type: 'BOOKING_NEW', title: 'Günay Səfərli rezerv etdi', body: `Qaş laminasiyası, ${T('16:30')} · Lalə`, data: { bookingId: day0[6].id }, createdAt: iso(0, 9), readAt: null },
    { id: 3, type: 'STOCK_LOW', title: 'Kirpik yapışqanı Sky az qalıb', body: '3 ədəd qalıb · Anbar', data: null, createdAt: iso(0, 9), readAt: null },
    { id: 4, type: 'REVIEW_NEW', title: 'Leyla Həsənova 5 ulduz verdi', body: '"Aysel saçımı tam istədiyim kimi etdi."', data: null, createdAt: iso(-1, 19), readAt: iso(-1, 20) },
  ] };
  const reviews = [
    { id: 1, rating: 5, comment: 'Aysel saçımı tam istədiyim kimi etdi. Salon çox təmiz və sakitdir.', createdAt: iso(-2, 18), authorName: 'Leyla Həsənova', reply: 'Təşəkkür edirik, Leyla xanım! Yenə gözləyirik.', repliedAt: iso(-2, 20), serviceName: 'Saç yuma və fen', staffName: 'Aysel' },
    { id: 2, rating: 5, comment: 'Kirpiklər 3 həftədir eynidir. Lalə xanıma təşəkkürlər!', createdAt: iso(-5, 12), authorName: 'Nərmin Quliyeva', reply: null, repliedAt: null, serviceName: 'Kirpik artırma 2D', staffName: 'Lalə' },
    { id: 3, rating: 4, comment: 'Kəsim əla idi, sadəcə 10 dəqiqə gözlədim.', createdAt: iso(-7, 12), authorName: 'Tural Abbasov', reply: null, repliedAt: null, serviceName: 'Saç + saqqal', staffName: 'Kamran' },
  ];
  const dash = { series: [3,2,5,4,6,3,2,7,8,6,7,9,5,6,10,11,8,9,12,10,9,13,12,11,14,13,15,14,16,17], kpis: { revenue: { value: 6840, previous: 6100 }, bookings: { value: 186, previous: 171 }, newClients: { value: 31, previous: 24 }, averageTicket: { value: 37, previous: 36 } },
    topServices: [{ name: 'Kirpik artırma 2D', bookings: 38, revenue: 2280 }, { name: 'Gel-lak manikür', bookings: 44, revenue: 1320 }, { name: 'Qadın saç kəsimi', bookings: 31, revenue: 1085 }],
    staff: staff.map((s, i) => ({ name: s.name.split(' ')[0], visits: 40 - i * 4, revenue: 1800 - i * 220, utilization: s.load })), sources: [{ source: 'web', bookings: 112 }, { source: 'manual', bookings: 74 }] };
  const hours = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'].map((d, i) => ({ dayOfWeek: d, enabled: i < 6, startTime: '09:00', endTime: '20:00' }));
  const notif = { emailConfirmation: true, emailReminder: true, emailCancellation: true, emailReschedule: true, emailWaitlist: false, emailReviewRequest: true, salonAlerts: true, reminderHoursBefore: 24, smsEnabled: false, pushEnabled: true, smsAvailable: true, pushAvailable: true, senderName: 'Mirvari', replyTo: null };
  const prefs = { types: ['BOOKING_NEW', 'BOOKING_CANCELLED', 'BOOKING_RESCHEDULED', 'REVIEW_NEW', 'STOCK_LOW', 'WAITLIST', 'PAYMENT'], pushOff: ['STOCK_LOW'], inboxOff: [], emailOff: [], quietStart: '22:00', quietEnd: '08:00', staff: [], stockThreshold: 5 };
  const GRID = ['p7755215', 'p7755531', 'p3997381', 'p7755225', 'f04', 'p8558246', 'p7755211', 'p7447142', 'p7755650', 'f01', 'p7755520', 'p3998417', 'p7755235', 'f03', 'p7518700'];
  const looks = GRID.map((g, i) => ({ id: i + 1, photoUrl: ph(g), title: ['Yumşaq qıvrımlar', '2D kirpik', 'Qırmızı klassika', 'Qısa bob', 'Gün makiyajı', 'Qaş laminasiyası'][i % 6], serviceName: services[i % services.length].name, status: 'PUBLISHED', likes: 212 - i * 9, views: 3412 - i * 120 }));
  const user = { accessToken: 'demo', refreshToken: 'demo', userId: 'demo-owner', fullName: 'Sevinc Məmmədova', email: 'demo@booqi.az', role: 'BUSINESS_OWNER', businessId: null };
  const inRange = (q: URLSearchParams) => { const a = q.get('startDate') ?? q.get('date') ?? D(0); const b = q.get('endDate') ?? a; return appts.filter((x) => x.appointmentDate >= a && x.appointmentDate <= b); };
  const todayList = appts.filter((a) => a.appointmentDate === D(0) && a.status !== 'CANCELLED');
  const routes: Route[] = [
    [/^\/public\/studios\/[^/]+\/services\/[^/]+\/slots/, (_m: string, _p: string, q: URLSearchParams) => {
      const isToday = (q.get('date') ?? D(0)) === D(0); const all = ['10:00', '10:30', '11:00', '12:30', '13:00', '14:30', '15:00', '16:00', '17:30', '18:00', '18:30', '19:00'];
      return { availableSlots: all.filter((s) => !isToday || toM(s) > nowMin).filter((_s, i) => i % 5 !== 2), durationMinutes: 60 };
    }],
    [/^\/public\/auth\/login/, user],
    [/^\/businesses\/owner\//, [biz, { ...biz, id: 'demo-nail', name: 'Mirvari Nail Studio', logoUrl: ph('p7755235'), myRole: 'OWNER' }]],
    [/^\/bookings\/business\/[^/]+\/clients/, clientsAll],
    [/^\/bookings\/business\/[^/]+\/slot-discounts/, []],
    [/^\/bookings\/business\//, (_m: string, _p: string, q: URLSearchParams) => inRange(q)],
    [/^\/bookings\/[^/]+$/, (_m: string, p: string) => appts.find((a) => a.id === p.split('/').pop()) ?? day0[1]],
    [/^\/businesses\/[^/]+\/day-sheet/, { date: D(0), totals: { bookings: todayList.length, expected: todayList.reduce((s, a) => s + (a.price ?? 0), 0), already_paid: 25 } }],
    [/^\/reviews\/business\/[^/]+\/summary/, { count: 312, average: 4.9 }],
    [/^\/businesses\/[^/]+\/looks/, looks],
    [/^\/businesses\/[^/]+\/stories/, [{ id: 1, url: ph('f01'), caption: 'Kirpik artırma 2D · 60 ₼', viewCount: 318, expiresAt: iso(20) }, { id: 2, url: ph('f02'), caption: 'Bu səhər: yumşaq qıvrımlar', viewCount: 204, expiresAt: iso(22) }, { id: 3, url: ph('f03'), caption: '', viewCount: 96, expiresAt: iso(23) }]],
    [/^\/businesses\/demo[^/]*$/, biz],
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
    [/^\/businesses\/[^/]+\/clients\/[^/]+\/record/, { notes: [{ id: 1, kind: 'ALLERGY', body: 'Lateks yapışqan. Hipoallergen istifadə edin.', pinned: true, author_name: 'Lalə', created_at: iso(-30) }, { id: 2, kind: 'NOTE', body: 'Rəng: 7.1 kül sarışın, oksid 6%. Uclarına keratin.', pinned: false, author_name: 'Aysel', created_at: iso(-14) }], visits: clientsAll.slice(0, 4).map((c, i) => ({ id: i, appointment_date: D(-7 * (i + 1)), start_time: '12:00', service_name: services[i].name, price: services[i].price, status: 'COMPLETED', staff_name: staff[i % 4].name })) }],
    [/^\/waitlist\/business\//, [{ id: 'w1', clientName: 'Rəna Q.', clientPhone: '+994 50 000 00 00', preferredDate: D(1), status: 'WAITING', serviceName: 'Gel lak', staffName: 'Aysel' }]],
    [/^\/reviews\/business\//, reviews],
    [/^\/analytics\/business\//, dash],
    [/^\/business-hours-exceptions/, []],
    [/^\/business-hours\//, hours],
    [/\/readiness$/, { bookable: true, missing: [], recommended: ['photos'] }],
    [/^\/services\/assignments\//, []],
    [/^\/public\/business-categories/, [{ slug: 'hair-salons', name: 'Hair Salons', label: 'Saç salonları' }, { slug: 'nail-salons', name: 'Nail Salons', label: 'Dırnaq salonları' }, { slug: 'barbers', name: 'Barbers', label: 'Bərbərlər' }]],
    [/^\/notifications\/inbox\/unread-count/, { unread: 3 }],
    [/^\/notifications\/inbox/, inbox],
    [/^\/notifications\/preferences/, prefs],
    [/^\/businesses\/[^/]+\/hub-events/, { unread: 2, events: [] }],
    [/^\/businesses\/[^/]+\/notification-settings/, notif],
    [/^\/businesses\/[^/]+\/subscription/, { plan: 'PRO', status: 'ACTIVE', trialEndsAt: null, currentPeriodEnd: iso(20) }],
    [/^\/businesses\/[^/]+\/tips/, { totals: { total: 120, outstanding: 40, cash: 50, card: 70, lines: 12 }, byStaff: [{ staff_name: 'Nigar', earned: 60, outstanding: 20 }] }],
    [/^\/products\/business\//, [{ id: 1, name: 'Gel lak bazası', sku: 'GL-1', price: 12, quantityOnHand: 2, lowStockThreshold: 5, isActive: true, lowStock: true }, { id: 2, name: 'Şampun 500ml', sku: 'SH-5', price: 24, quantityOnHand: 14, lowStockThreshold: 4, isActive: true, lowStock: false }]],
    [/profit-and-loss/, { months: [{ month: '2026-11', revenue: 4820, expenses: 1240, wages: 1480, profit: 2100 }, { month: '2026-10', revenue: 4100, expenses: 1180, wages: 1400, profit: 1520 }], totals: { revenue: 8920, expenses: 2420, wages: 2880, profit: 3620 } }],
    [/\/tax/, { totals: { count: 120, net: 4090, tax: 730, gross: 4820 }, byRate: [{ rate: 18, net: 4090, tax: 730 }] }],
    [/\/cash-drawer/, null],
    [/\/marketing-automation/, { birthdayEnabled: true, birthdayDaysBefore: 3, birthdaySubject: null, birthdayBody: null, winbackEnabled: false, winbackDaysAfter: 45, winbackSubject: null, winbackBody: null, sentLast30Days: 38 }],
    [/^\/marketing\/campaigns/, [{ id: 1, name: 'Qara cümə endirimi', channel: 'EMAIL', segment: 'ALL_CLIENTS', subject: 's', body: 'b', status: 'SENT', recipientCount: 412, sentCount: 398 }, { id: 2, name: 'Yeni gel lak', channel: 'SMS', segment: 'VIP', subject: null, body: 'b', status: 'DRAFT', recipientCount: 86 }]],
    [/\/staff-targets/, [{ staffId: 'aysel', staffName: 'Aysel', revenueTarget: 2400, bookingsTarget: 50, revenueActual: 2100, bookingsActual: 44 }, { staffId: 'nigar', staffName: 'Nigar', revenueTarget: 2000, bookingsTarget: 45, revenueActual: 1500, bookingsActual: 39 }, { staffId: 's3', staffName: 'Sabina', revenueTarget: 1800, bookingsTarget: 30, revenueActual: 1900, bookingsActual: 31 }]],
    [/\/roles$/, [{ id: 1, name: 'Sahib', isOwner: true, isDefault: false, permissions: ['a', 'b', 'c', 'd'], memberCount: 1 }, { id: 2, name: 'Menecer', isOwner: false, isDefault: false, permissions: ['a', 'b'], memberCount: 2 }, { id: 3, name: 'Mütəxəssis', isOwner: false, isDefault: true, permissions: ['a'], memberCount: 4 }]],
    [/^\/quick-sale/, [{ id: 1, serviceId: 'v3', serviceName: 'Gel lak', price: 40 }, { id: 2, serviceId: 'v2', serviceName: 'Qaş və kirpik', price: 35 }]],
    [/\/rota/, (_m: string, _p: string, q: URLSearchParams) => { const w0 = new Date(q.get('weekStart') ?? D(0)); const dd = (i: number) => { const x = new Date(w0); x.setDate(x.getDate() + i); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; }; return { weekStart: dd(0), weekEnd: dd(6), staff: staff.map((st, si) => ({ id: st.id, name: st.name, position: st.position, days: Array.from({ length: 7 }, (_x, i) => ({ date: dd(i), dayOfWeek: i + 1, state: i === 6 || (i === 5 && si % 2) ? 'OFF' : i === 2 && si === 1 ? 'TIME_OFF' : 'WORKING', start: '09:00', end: '18:00' })) })) }; }],
    [/custom-reports\/catalog/, [{ key: 'bookings', label: 'Rezervlər', columns: [{ key: 'date', label: 'Tarix' }, { key: 'count', label: 'Say' }, { key: 'revenue', label: 'Gəlir' }], defaultGroupBy: 'date' }, { key: 'clients', label: 'Müştərilər', columns: [{ key: 'name', label: 'Ad' }, { key: 'visits', label: 'Gəliş' }], defaultGroupBy: null }, { key: 'sales', label: 'Satışlar', columns: [{ key: 'day', label: 'Gün' }, { key: 'total', label: 'Cəmi' }], defaultGroupBy: null }]],
    [/custom-reports\/run/, { columns: [{ key: 'date', label: 'Tarix' }, { key: 'count', label: 'Say' }, { key: 'revenue', label: 'Gəlir' }], rows: [['Cümə', 11, 640], ['Cümə axşamı', 9, 520], ['Çərşənbə', 12, 710]], truncated: false }],
    [/^\/addons\/business/, [{ id: 1, name: 'Dırnaq dizaynı', price: 10, priceType: 'FIXED', isActive: true }, { id: 2, name: 'Parafin', price: 15, priceType: 'FIXED', isActive: true }]],
    [/^\/support\/tickets\/[^/]+$/, { ticket: { ref: 'T-101', category: 'BOOKING', subject: 'Rezerv vaxtı dəyişmir', status: 'OPEN', lastMessageAt: iso(0, 9) }, messages: [{ id: 1, authorType: 'USER', authorName: 'Leyla', body: 'Salam, müştərinin rezervini köçürə bilmirəm.', createdAt: iso(0, 9) }, { id: 2, authorType: 'STAFF', authorName: 'booqi dəstək', body: 'Salam Leyla! Baxırıq, bir neçə dəqiqəyə cavab yazacağıq.', createdAt: iso(0, 10) }] }],
    [/^\/support\/tickets/, [{ ref: 'T-101', category: 'BOOKING', subject: 'Rezerv vaxtı dəyişmir', status: 'OPEN', lastMessageAt: iso(0, 9) }, { ref: 'T-087', category: 'PAYMENT', subject: 'Faktura sualı', status: 'RESOLVED', lastMessageAt: iso(-5, 9) }]],
    [/^\/packages\/client\//, [{ id: 'cp1', package_id: 'p1', package_name: 'Gel lak 5 seans', service_id: 'v3', sessions_total: 5, sessions_remaining: 3, expires_at: iso(60), purchased_at: iso(-20) }, { id: 'cp2', package_id: 'p2', package_name: 'Üz baxımı 3 seans', service_id: 'v5', sessions_total: 3, sessions_remaining: 0, expires_at: null, purchased_at: iso(-90) }]],
    [/^\/packages\/business\//, [{ id: 'p1', name: 'Gel lak 5 seans', service_id: 'v3', sessions_total: 5, price: 160, active: true }, { id: 'p2', name: 'Üz baxımı 3 seans', service_id: 'v5', sessions_total: 3, price: 210, active: true }, { id: 'p3', name: 'Saç kəsimi 10 seans', service_id: 'v4', sessions_total: 10, price: 360, active: true }]],
    [/whatsapp-reminders/, (_m: string, _p: string, q: URLSearchParams) => ({ date: q.get('date') ?? D(1), rows: appts.map((a) => ({ id: a.id, clientName: a.clientName, phone: a.clientPhone, serviceName: a.serviceName, staffName: a.staffName, startTime: a.startTime, text: `Salam, ${a.clientName}! Sabah saat ${a.startTime} ${a.serviceName} üçün Mirvari Beauty Lounge-da sizi gözləyirik. Dəyişiklik üçün cavab yazın.`, waUrl: `https://wa.me/994501112233?text=Salam`, sentAt: a.id === 'a2' ? iso(0, 9) : null })) })],
    [/\/services\/business\/[^/]+\/packages/, [{ serviceId: 'v9', maxPartySize: 3, totalDurationMinutes: 210, totalPrice: 285, steps: [{ position: 0, serviceId: 'v4', serviceName: 'Qadın saç kəsimi', staffId: 'aysel', staffName: 'Aysel', parallel: false, durationMinutes: 60, price: 45 }, { position: 1, serviceId: 'v1', serviceName: 'Boyama', staffId: null, staffName: null, parallel: false, durationMinutes: 120, price: 120 }, { position: 2, serviceId: 'v2', serviceName: 'Qaş və kirpik', staffId: 's3', staffName: 'Sabina', parallel: true, durationMinutes: 45, price: 35 }] }]],
    [/bookings\/package\/slots/, { date: D(1), name: 'Gəlin paketi', partySize: 1, maxPartySize: 3, durationMinutes: 210, availableSlots: ['10:00', '12:30', '15:00', '16:30'], price: 285 }],
    [/\/promotion\/history/, [{ id: 'pr1', startsAt: iso(-10), endsAt: iso(-3), days: 7, amount: 49, currency: 'AZN', source: 'PAID', status: 'ENDED', impressions: 8420, clicks: 312, bookings: 19, ctr: 0.037, daysLeft: 0, spentAmount: 49 }, { id: 'pr2', startsAt: iso(-2), endsAt: iso(12), days: 14, amount: 89, currency: 'AZN', source: 'PAID', status: 'ACTIVE', impressions: 2100, clicks: 88, bookings: 5, ctr: 0.042, daysLeft: 12, spentAmount: 12 }]],
    [/\/marketplace-promotion/, { promoted: true, daily: Array.from({ length: 14 }, (_x, i) => ({ date: D(i - 13), bookings: [1, 0, 2, 1, 3, 2, 4, 3, 2, 5, 4, 6, 5, 7][i] })) }],
    [/\/promotion$/, { enabled: true, currency: 'AZN', alreadyRunning: false, packages: [{ id: 'k1', nameAz: 'Başlanğıc', nameEn: 'Starter', nameRu: 'Старт', days: 7, price: 49, currency: 'AZN', forecastKnown: true, forecastPerDay: 1200 }, { id: 'k2', nameAz: 'Populyar', nameEn: 'Popular', nameRu: 'Популярный', days: 14, price: 89, currency: 'AZN', forecastKnown: true, forecastPerDay: 1500 }, { id: 'k3', nameAz: 'Maksimum', nameEn: 'Max', nameRu: 'Макс', days: 30, price: 169, currency: 'AZN', forecastKnown: false, forecastPerDay: 0 }] }],
    [/\/purchase-orders\/suggest/, [{ product_id: 'pr_1', name: 'Gel lak bazası', sku: 'GL-1', quantity_on_hand: 2, low_stock_threshold: 5, suggested: 8 }, { product_id: 'pr_5', name: 'Cuticle yağı', sku: 'CY-3', quantity_on_hand: 1, low_stock_threshold: 4, suggested: 7 }]],
    [/\/purchase-orders\/[^/]+$/, { id: 'po1', supplier_name: 'Beauty Pro MMC', status: 'ORDERED', total_amount: 240, lines: [{ id: 'l1', product_id: 'pr_1', product_name: 'Gel lak bazası', quantity: 10, received: 0, unit_cost: 12 }, { id: 'l2', product_id: 'pr_5', product_name: 'Cuticle yağı', quantity: 6, received: 2, unit_cost: 20 }] }],
    [/\/purchase-orders$/, [{ id: 'po1', reference: 'PO-14', status: 'ORDERED', ordered_on: D(-2), expected_on: D(3), total_amount: 240, supplier_name: 'Beauty Pro MMC', lines: 2 }, { id: 'po0', reference: 'PO-13', status: 'RECEIVED', ordered_on: D(-20), expected_on: D(-14), total_amount: 180, supplier_name: 'Nail Studio Supply', lines: 3 }]],
    [/\/suppliers$/, [{ id: 'sp1', name: 'Beauty Pro MMC', contact_name: 'Rauf Əliyev', email: 'rauf@beautypro.az', phone: '+994 12 555 11 22', account_number: '1400123456', notes: null, is_active: true }, { id: 'sp2', name: 'Nail Studio Supply', contact_name: 'Günay', email: null, phone: '+994 50 777 88 99', account_number: null, notes: null, is_active: true }]],
    [/\/stock\/levels/, [{ id: 'pr_1', name: 'Gel lak bazası', sku: 'GL-1', quantity_on_hand: 2 }, { id: 'pr_2', name: 'Şampun 500ml', sku: 'SH-5', quantity_on_hand: 14 }, { id: 'pr_3', name: 'Top coat', sku: 'TC-2', quantity_on_hand: 8 }, { id: 'pr_4', name: 'Pambıq disk', sku: 'PD-9', quantity_on_hand: 40 }]],
    [/import\/preview/, { rows: [{ row: 1, status: 'NEW', reason: null, name: 'Leyla Qasımova', phone: '+994501112233', email: null, matchedName: null }, { row: 2, status: 'MERGE_EXISTING', reason: null, name: 'Nərmin Həsənova', phone: '+994501002040', email: null, matchedName: 'Nərmin Həsənova' }, { row: 3, status: 'ERROR', reason: 'Telefon formatı səhvdir', name: 'Aysu', phone: '123', email: null, matchedName: null }], counts: { NEW: 1, MERGE_EXISTING: 1, MERGE_IN_FILE: 0, ERROR: 1 } }],
    [/^\/team-permissions/, [{ key: 'a', group: 'Rezerv', label: 'Rezervlərə baxış', description: '' }, { key: 'b', group: 'Rezerv', label: 'Rezerv əlavə et', description: '' }, { key: 'c', group: 'Kassa', label: 'Satış', description: '' }, { key: 'd', group: 'Kassa', label: 'Qaytarma', description: '' }]],
  ];
  { const i = routes.findIndex(([re]) => re.source.includes('packages') && re.source.includes('services')); if (i > 0) routes.unshift(routes.splice(i, 1)[0]); }
  return { routes, user, biz };
}
