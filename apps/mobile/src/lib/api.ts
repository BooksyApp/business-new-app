import { Platform } from 'react-native';
import { ApiError, businessAudience, createApi, type Id } from '@booqi/business-shared';

import { API_BASE } from './config';
import { setOnline } from './net';
import * as storage from './secureStorage';

export { ApiError };
export type { Id };

// ---------------------------------------------------------------- types
export type ApptStatus = 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  userId: Id;
  fullName: string;
  email: string;
  role: string;
  businessId: Id | null;
}

export interface Business {
  id: Id;
  name: string;
  currency?: string;
  address?: string;
  city?: string;
  phone?: string;
  myRole?: string;
}

export interface Staff {
  id: Id;
  name: string;
  position?: string;
  avatarUrl?: string;
  isActive?: boolean;
  email?: string;
  phone?: string;
  role?: string;
}

export interface Service {
  id: Id;
  name: string;
  durationMinutes?: number;
  price?: number;
  priceType?: 'FIXED' | 'FROM' | 'RANGE';
  priceMax?: number | null;
  isActive: boolean;
  isVisible?: boolean;
  categoryName?: string;
  description?: string;
  staffIds?: Id[];
}

export interface Appointment {
  id: string;
  businessId: Id;
  staffId: Id;
  staffName?: string;
  clientId?: Id;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  serviceId: Id;
  serviceName?: string;
  visitId?: string | null;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  status: ApptStatus;
  paymentStatus: string | null;
  price?: number;
  depositAmount?: number | null;
  depositPaid?: boolean | null;
  notes?: string;
  /** Set when the customer taps "running late" in their app (POST /api/customer/bookings/{id}/late). */
  lateMinutes?: number | null;
  lateNotedAt?: string | null;
  /** Optional hints the backend may or may not send; used for the small tile markers only when present. */
  bookingSource?: string | null;
  staffAutoAssigned?: boolean | null;
  clientAlert?: boolean | null;
  guestName?: string | null;
  /** JSON text [{question, answer}] the client gave to the service's booking questions. */
  clientAnswers?: string | null;
  /** The customer's answers to the service's booking questions (the API sends this array; clientAnswers is not serialized). */
  answers?: { question: string; answer: string }[] | null;
  clientAddress?: string | null;
  travelFee?: number | null;
  promoCode?: string | null;
  paidAmount?: number | null;
  prepaidAmount?: number | null;
  cancellationReason?: string | null;
  color?: string | null;
}

export interface Client {
  id: Id;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  notes: string | null;
}

export interface ClientWithStats extends Client {
  totalVisits: number;
  totalSpent: number | null;
  lastVisitDate: string | null;
  clientKey?: string;
  avatarUrl?: string | null;
  createdAt?: string | null;
  pastVisits?: number;
  avgPrice?: number | null;
  favouriteService?: string | null;
  favouriteMaster?: string | null;
  nextVisitDate?: string | null;
  nextVisitTime?: string | null;
  nextServiceName?: string | null;
  noShowAppointments?: number;
  cancelledAppointments?: number;
  allowMarketingEmails?: boolean | null;
  allowSmsNotifications?: boolean | null;
  vip?: boolean;
}

export interface ClientNote {
  id: Id;
  kind: string;
  body: string;
  pinned: boolean;
  author_name: string | null;
  created_at: string;
}

export interface ClientRecord {
  notes: ClientNote[];
  visits: {
    id: Id;
    appointment_date: string;
    start_time: string;
    service_name: string | null;
    price: number | null;
    status: string;
    staff_name: string | null;
  }[];
}

export interface WaitlistEntry {
  id: Id;
  clientName: string | null;
  clientPhone: string | null;
  preferredDate: string | null;
  status: string;
  serviceName: string | null;
  staffName: string | null;
}

export interface DaySheet {
  date: string;
  totals: { bookings: number; expected: number; already_paid: number };
}

export interface TimeOff {
  id: Id;
  staffId: Id;
  staffName?: string;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  isFullDay: boolean;
  reason?: string | null;
  recurrenceEndDate?: string | null;
}

export interface Sale {
  id: Id;
  clientName?: string;
  staffName?: string;
  saleDate: string;
  saleTime: string;
  total: number;
  tipAmount?: number;
  paymentMethod: string;
  items?: { name?: string; itemName?: string }[];
}

export interface InboxSummary {
  conversationId: string;
  customerName: string;
  customerEmail: string;
  unread: number;
  lastMessageAt: string | null;
  /** Absolute instant (ISO, Z) of the last message; lastMessageAt is a zone-less server wall time. */
  lastMessageAtInstant?: string | null;
}
export interface InboxMessage { messageId: string; fromSalon: boolean; body: string; sentAt: string; sentAtInstant?: string | null }
export interface InboxThread { conversationId: string; customerName: string; customerEmail: string; messages: InboxMessage[] }

export interface CreateAppointmentBody {
  businessId: Id;
  staffId: Id;
  clientId?: Id;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  serviceId: Id;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  price?: number;
  notes?: string;
  visitId?: string;
}


// ---------------------------------------------------------------- session
const K = { access: 'biz.access', refresh: 'biz.refresh', user: 'biz.user', salon: 'biz.salon' };

let accessToken: string | null = null;
let refreshToken: string | null = null;
let onSignedOut: (() => void) | null = null;

export function setSignedOutHandler(fn: (() => void) | null) {
  onSignedOut = fn;
}

export async function loadSession(): Promise<{ user: AuthResponse | null; salonId: Id | null }> {
  accessToken = await storage.getItem(K.access);
  refreshToken = await storage.getItem(K.refresh);
  const raw = await storage.getItem(K.user);
  const salonId = await storage.getItem(K.salon);
  let user: AuthResponse | null = null;
  try {
    user = raw ? (JSON.parse(raw) as AuthResponse) : null;
  } catch {
    user = null;
  }
  return { user: accessToken && refreshToken ? user : null, salonId };
}

export async function saveSession(a: AuthResponse) {
  accessToken = a.accessToken;
  refreshToken = a.refreshToken;
  await storage.setItem(K.access, a.accessToken);
  await storage.setItem(K.refresh, a.refreshToken);
  await storage.setItem(K.user, JSON.stringify({ ...a, accessToken: '', refreshToken: '' }));
}

export async function saveSalon(id: Id) {
  await storage.setItem(K.salon, id);
}

export async function clearSession() {
  accessToken = null;
  refreshToken = null;
  await Promise.all(Object.values(K).map((k) => storage.removeItem(k)));
}

/** One refresh at a time: the server rotates the refresh token (logic of the old business-app/api.ts). */
let refreshing: Promise<string | null> | null = null;
function renew(): Promise<string | null> {
  if (refreshing) return refreshing;
  const rt = refreshToken;
  if (!rt) return Promise.resolve(null);
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 15000);
  refreshing = fetch(`${API_BASE}/api/auth/refresh`, {
    signal: ctl.signal,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt }),
  })
    .then(async (r) => {
      if (r.status >= 500) throw new Error('refresh unavailable'); // server trouble is not a revoked session
      if (!r.ok) return null;
      const d = (await r.json()) as Partial<AuthResponse>;
      if (!d.accessToken) return null;
      accessToken = d.accessToken;
      await storage.setItem(K.access, d.accessToken);
      if (d.refreshToken) {
        refreshToken = d.refreshToken;
        await storage.setItem(K.refresh, d.refreshToken);
      }
      return d.accessToken;
    })
    .finally(() => {
      clearTimeout(timer);
      refreshing = null;
    });
  return refreshing;
}

const core = createApi({
  baseUrl: API_BASE,
  getToken: () => accessToken,
  renew,
  onUnauthorized: () => {
    void clearSession();
    onSignedOut?.();
  },
});

/** Every call reports reachability to the offline banner (status 0 = the network failed; any HTTP answer = online). */
export async function request<T>(path: string, opts?: Parameters<typeof core.request>[1]): Promise<T> {
  try {
    const r = await core.request<T>(path, opts);
    setOnline(true);
    return r;
  } catch (e) {
    if (e instanceof ApiError) setOnline(e.status !== 0);
    throw e;
  }
}

/**
 * List endpoints: always an array. A live server may answer `null`/empty body, a paged `{content|items|data|results|keys: []}` or
 * an error-shaped object; the screens only ever see `T[]` with no null rows (".map of undefined" cannot happen).
 */
export async function requestList<T>(path: string, opts?: Parameters<typeof core.request>[1]): Promise<T[]> {
  const r = await request<unknown>(path, opts);
  const arr = Array.isArray(r) ? r : r && typeof r === 'object' ? (['content', 'items', 'data', 'results', 'keys', 'rows'].map((k) => (r as Record<string, unknown>)[k]).find(Array.isArray) as unknown[] | undefined) ?? [] : [];
  return arr.filter((x) => x != null) as T[];
}

/** Multipart upload. RN FormData file parts are `{ uri: 'file://...', name, type }` objects. Expo SDK 57 replaced the global `fetch` with expo/fetch,
 *  which cannot serialise those parts ("Unsupported FormDataPart implementation"), so uploads go through RN's native XMLHttpRequest, which can.
 *  No Content-Type header on purpose: the multipart boundary is added by the networking layer. One token renewal on 401, 60s timeout. */
function xhrPost(url: string, form: FormData, tok: string | null): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const x = new XMLHttpRequest();
    x.open('POST', url);
    x.timeout = 60000;
    x.setRequestHeader('Accept', 'application/json');
    if (tok) x.setRequestHeader('Authorization', `Bearer ${tok}`);
    x.onload = () => resolve({ status: x.status, text: x.responseText ?? '' });
    x.onerror = () => reject(new Error('şəbəkə'));
    x.ontimeout = () => reject(new Error('vaxt bitdi'));
    x.send(form as unknown as XMLHttpRequestBodyInit);
  });
}
export async function uploadForm<T>(path: string, form: FormData): Promise<T> {
  // Demo mode: the wrapped fetch makes writes a no-op (and shows the "demo does not save" toast); XHR would bypass it.
  if ((require('@/demo') as { isDemo: () => boolean }).isDemo()) { await fetch(`${API_BASE}/api${path}`, { method: 'POST' }).catch(() => null); return { id: 'demo', url: '' } as unknown as T; }
  const go = async (tok: string | null) => {
    try { return await xhrPost(`${API_BASE}/api${path}`, form, tok); }
    catch (e) { throw new ApiError(`Yükləmə alınmadı (${(e as Error)?.message || 'şəbəkə'})`, 0); }
  };
  let res = await go(accessToken);
  if (res.status === 401) { const nt = await renew().catch(() => null); if (nt) res = await go(nt); }
  const text = res.text;
  const okRes = res.status >= 200 && res.status < 300;
  let data: unknown = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!okRes) { const d = (data && typeof data === 'object' ? data : {}) as Record<string, unknown>; throw new ApiError(String(d.detail ?? d.message ?? d.error ?? `HTTP ${res.status}`), res.status, data); }
  setOnline(true);
  return data as T;
}

/** A public id the server accepts: UUID string or positive number. Anything else ("null", "0", "__none", "new-123") is a 400. */
export const validId = (v: unknown): string | null => {
  const s = v == null ? '' : String(v).trim();
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) return s;
  return /^[1-9]\d*$/.test(s) ? s : null;
};
const hhmmOk = (v: unknown) => (typeof v === 'string' && /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(v) ? v : undefined);
/**
 * Booking body exactly as BookingController.BookingRequest wants it: ids only when real (a walk-in or guest with no client row is
 * sent by name/phone/email, staffId 0 = unassigned), price a number, times HH:mm inside the day, empty optionals dropped.
 */
export function cleanBooking(b: CreateAppointmentBody & { clientEmail?: string }) {
  const price = Number(b.price);
  const email = (b.clientEmail ?? '').trim();
  const clientId = validId(b.clientId);
  return {
    businessId: b.businessId,
    staffId: validId(b.staffId) ?? 0,
    ...(clientId ? { clientId } : null),
    ...(b.clientName?.trim() ? { clientName: b.clientName.trim().slice(0, 255) } : null),
    ...(b.clientPhone?.trim() ? { clientPhone: b.clientPhone.trim().slice(0, 50) } : null),
    ...(email.includes('@') ? { clientEmail: email } : null),
    serviceId: b.serviceId,
    appointmentDate: b.appointmentDate,
    startTime: hhmmOk(b.startTime) ?? b.startTime,
    ...(hhmmOk(b.endTime) ? { endTime: b.endTime } : null),
    ...(Number.isFinite(price) && price >= 0 && b.price != null ? { price } : null),
    ...(b.notes?.trim() ? { notes: b.notes.trim().slice(0, 2000) } : null),
    ...(b.visitId ? { visitId: b.visitId } : null),
  };
}

const day = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
export { day as toDay };

// ---------------------------------------------------------------- endpoints
export const api = {
  /** POST /api/public/auth/login - `app` = IOS_BUSINESS or ANDROID_BUSINESS by Platform.OS (names defined in shared/api/audience.ts). */
  login: (emailOrPhone: string, password: string) =>
    request<AuthResponse>('/public/auth/login', {
      method: 'POST',
      auth: false,
      body: { emailOrPhone, password, app: businessAudience(Platform.OS) },
    }),
  logout: () => request<void>('/auth/logout', { method: 'POST', body: { refreshToken } }),

/** GET /api/businesses/owner/{userId} (owners) and /api/businesses/{id} (staff). */
  salonsForUser: async (u: AuthResponse): Promise<Business[]> => {
    if (u.role.toUpperCase() === 'STAFF' && u.businessId) {
      return [await request<Business>(`/businesses/${u.businessId}`)];
    }
    return (await requestList<Business>(`/businesses/owner/${u.userId}`)) ?? [];
  },

  /** GET /api/bookings/business/{id}?startDate&endDate */
  appointments: (b: Id, from: Date, to: Date = from) =>
    requestList<Appointment>(`/bookings/business/${b}?startDate=${day(from)}&endDate=${day(to)}`),
  appointment: (id: string) => request<Appointment>(`/bookings/${id}`),
  /** POST /api/bookings (`override.confirm` accepts a reported conflict, same shape as the reschedule PUT). */
  createAppointment: (body: CreateAppointmentBody, override?: boolean) =>
    request<Appointment>('/bookings', {
      method: 'POST',
      body: {
        ...cleanBooking(body),
        ...(override ? { override: { confirm: true } } : null),
        // appointments.idempotency_key is VARCHAR(100): ids are UUIDs, so never concatenate them (that was ~107 chars and every booking failed)
        idempotencyKey: `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
      },
    }),
  /** PUT /api/bookings/{id} — full body (reschedule). */
  updateAppointment: (id: string, body: CreateAppointmentBody, override?: boolean) =>
    request<Appointment>(`/bookings/${id}`, {
      method: 'PUT',
      body: override ? { ...cleanBooking(body), override: { confirm: true } } : cleanBooking(body),
    }),
  confirmAppointment: (id: string) =>
    request<Appointment>(`/bookings/${id}/confirm`, { method: 'PUT', body: {} }),
  completeAppointment: (id: string) =>
    request<Appointment>(`/bookings/${id}/complete`, { method: 'PUT', body: {} }),
  noShow: (id: string) =>
    request<Appointment>(`/bookings/${id}/no-show`, { method: 'PUT', body: {} }),
  cancelAppointment: (id: string, reason: string) =>
    request<void>(`/bookings/${id}/cancel`, { method: 'PUT', body: { reason } }),

  /** GET /api/staff/business/{id} */
  staff: (b: Id) => requestList<Staff>(`/staff/business/${b}`),
  /** GET /api/services/business/{id} */
  services: (b: Id) => requestList<Service>(`/services/business/${b}`),
  /** PUT /api/services/{id}/business/{b} - partial update (isActive, price, durationMinutes). */
  updateService: (b: Id, id: Id, body: { isActive?: boolean; price?: number; durationMinutes?: number }) =>
    request<Service>(`/services/${id}/business/${b}`, { method: 'PUT', body }),

  /** GET /api/time-off/business/{id}/date/{date} */
  timeOffOn: (b: Id, d: Date) => requestList<TimeOff>(`/time-off/business/${b}/date/${day(d)}`),
  /** POST /api/time-off (same body as the hub; owner/manager blocks are approved on creation). */
  createTimeOff: (body: { businessId: Id; staffId: Id; startDate: string; endDate: string; startTime?: string; endTime?: string; isFullDay: boolean; reason?: string }) =>
    request<TimeOff>('/time-off', { method: 'POST', body: { ...body, isRecurring: false, isApproved: true } }),
  deleteTimeOff: (id: Id) => request<void>(`/time-off/${id}`, { method: 'DELETE' }),

  /** GET /api/sales/business/{id}?date= */
  sales: (b: Id, d: Date) => requestList<Sale>(`/sales/business/${b}?date=${day(d)}`),

  /** GET/POST /api/businesses/{b}/messages/conversations */
  conversations: (b: Id) => requestList<InboxSummary>(`/businesses/${b}/messages/conversations`),
  conversation: (b: Id, c: string) => request<InboxThread>(`/businesses/${b}/messages/conversations/${encodeURIComponent(c)}`),
  replyConversation: (b: Id, c: string, body: string) =>
    request<InboxMessage>(`/businesses/${b}/messages/conversations/${encodeURIComponent(c)}/messages`, { method: 'POST', body: { body } }),
  /** GET /api/public/studios/{b}/services/{s}/slots?date&staffId -> { availableSlots: string[] } */
  slots: (b: Id, serviceId: Id, date: Date, staffId?: Id, extraMinutes?: number, excludeBookingId?: string) =>
    request<{ availableSlots: string[]; durationMinutes: number; slotIntervalMinutes?: number; nextAvailableDate?: string | null }>(
      `/public/studios/${b}/services/${serviceId}/slots?date=${day(date)}${staffId ? `&staffId=${staffId}` : ''}${extraMinutes ? `&extraMinutes=${extraMinutes}` : ''}${excludeBookingId ? `&excludeBookingId=${encodeURIComponent(excludeBookingId)}` : ''}`,
    ), // signed in on purpose: the server drops the online minimum notice for the salon's own team

  /**
   * POST /api/public/studios/{b}/basket/slots: bookable start times for a whole visit (items back to back). `excludeBookingId` (any booking of the
   * visit) makes the visit's own rows count as free, so small shifts are offered. Resolves to the chain start times ("HH:mm").
   */
  basketSlots: (b: Id, date: Date, items: { serviceId: Id; staffId: Id | null }[], excludeBookingId?: string) =>
    request<{ slots?: { startTime?: string }[] }>(`/public/studios/${b}/basket/slots`, { method: 'POST', body: { date: day(date), items, ...(excludeBookingId ? { excludeBookingId } : {}) } })
      .then((r) => (Array.isArray(r?.slots) ? r!.slots! : []).map((s) => (s.startTime ?? '').slice(0, 5)).filter(Boolean)),
  /** PUT /api/bookings/visit/{visitId}/reschedule: moves every live part of a multi-service visit; `startTime` is where the first part starts. */
  rescheduleVisit: (visitId: string, body: { businessId: Id; appointmentDate: string; startTime: string }) =>
    request<unknown>(`/bookings/visit/${visitId}/reschedule`, { method: 'PUT', body }),

  /** GET /api/bookings/business/{id}/clients (with stats) */
  clientsWithStats: (b: Id) =>
    requestList<ClientWithStats>(`/bookings/business/${b}/clients?limit=1000&offset=0`),
  /** GET /api/clients/business/{id} */
  clients: (b: Id) => requestList<Client>(`/clients/business/${b}`),
  /** POST /api/clients/business/{id} */
  createClient: (b: Id, body: { firstName: string; lastName?: string; phone?: string; email?: string; allowMarketingEmails?: boolean; allowSmsNotifications?: boolean }) =>
    request<Client>(`/clients/business/${b}`, { method: 'POST', body }),
  /** GET /api/businesses/{b}/clients/{c}/record -> notes + visits */
  clientRecord: (b: Id, c: Id) => request<ClientRecord>(`/businesses/${b}/clients/${c}/record`),
  addClientNote: (b: Id, c: Id, body: string) =>
    request<ClientNote>(`/businesses/${b}/clients/${c}/notes`, {
      method: 'POST',
      body: { kind: 'NOTE', body },
    }),
  /** PUT /api/businesses/{b}/client-notes/{id}: the salon edits its own private note. */
  updateClientNote: (b: Id, noteId: Id, body: string) =>
    request<ClientNote>(`/businesses/${b}/client-notes/${noteId}`, { method: 'PUT', body: { body } }),
  /** DELETE /api/businesses/{b}/client-notes/{id} */
  deleteClientNote: (b: Id, noteId: Id) =>
    request<void>(`/businesses/${b}/client-notes/${noteId}`, { method: 'DELETE' }),

  /** GET /api/waitlist/business/{id} */
  waitlist: (b: Id) => requestList<WaitlistEntry>(`/waitlist/business/${b}`),
  /** GET /api/businesses/{id}/day-sheet?date= */
  daySheet: (b: Id, date: Date) =>
    request<Partial<DaySheet> | null>(`/businesses/${b}/day-sheet?date=${day(date)}`).then((r): DaySheet => ({ date: r?.date ?? day(date), totals: { bookings: Number(r?.totals?.bookings) || 0, expected: Number(r?.totals?.expected) || 0, already_paid: Number(r?.totals?.already_paid) || 0 } })),

  /** POST /api/notifications/device-tokens - platform must be IOS | ANDROID | WEB. */
  registerDeviceToken: (token: string) =>
    request<unknown>('/notifications/device-tokens', {
      method: 'POST',
      body: { token, platform: Platform.OS === 'ios' ? 'IOS' : Platform.OS === 'android' ? 'ANDROID' : 'WEB' },
    }),
};
