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
}
export interface InboxMessage { messageId: string; fromSalon: boolean; body: string; sentAt: string }
export interface InboxThread { conversationId: string; customerName: string; customerEmail: string; messages: InboxMessage[] }

export interface CreateAppointmentBody {
  businessId: Id;
  staffId: Id;
  clientId?: Id;
  clientName?: string;
  clientPhone?: string;
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
  refreshing = fetch(`${API_BASE}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken: rt }),
  })
    .then(async (r) => {
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
    .catch(() => null)
    .finally(() => {
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
async function request<T>(path: string, opts?: Parameters<typeof core.request>[1]): Promise<T> {
  try {
    const r = await core.request<T>(path, opts);
    setOnline(true);
    return r;
  } catch (e) {
    if (e instanceof ApiError) setOnline(e.status !== 0);
    throw e;
  }
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
    return (await request<Business[]>(`/businesses/owner/${u.userId}`)) ?? [];
  },

  /** GET /api/bookings/business/{id}?startDate&endDate */
  appointments: (b: Id, from: Date, to: Date = from) =>
    request<Appointment[]>(`/bookings/business/${b}?startDate=${day(from)}&endDate=${day(to)}`),
  appointment: (id: string) => request<Appointment>(`/bookings/${id}`),
  /** POST /api/bookings (`override.confirm` accepts a reported conflict, same shape as the reschedule PUT). */
  createAppointment: (body: CreateAppointmentBody, override?: boolean) =>
    request<Appointment>('/bookings', {
      method: 'POST',
      body: {
        ...body,
        ...(override ? { override: { confirm: true } } : null),
        idempotencyKey: `${body.businessId}-${body.staffId}-${body.appointmentDate}-${body.startTime}-${Date.now()}`,
      },
    }),
  /** PUT /api/bookings/{id} — full body (reschedule). */
  updateAppointment: (id: string, body: CreateAppointmentBody, override?: boolean) =>
    request<Appointment>(`/bookings/${id}`, {
      method: 'PUT',
      body: override ? { ...body, override: { confirm: true } } : body,
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
  staff: (b: Id) => request<Staff[]>(`/staff/business/${b}`),
  /** GET /api/services/business/{id} */
  services: (b: Id) => request<Service[]>(`/services/business/${b}`),
  /** PUT /api/services/{id}/business/{b} - partial update (isActive, price, durationMinutes). */
  updateService: (b: Id, id: Id, body: { isActive?: boolean; price?: number; durationMinutes?: number }) =>
    request<Service>(`/services/${id}/business/${b}`, { method: 'PUT', body }),

  /** GET /api/time-off/business/{id}/date/{date} */
  timeOffOn: (b: Id, d: Date) => request<TimeOff[]>(`/time-off/business/${b}/date/${day(d)}`),
  /** POST /api/time-off (same body as the hub; owner/manager blocks are approved on creation). */
  createTimeOff: (body: { businessId: Id; staffId: Id; startDate: string; endDate: string; startTime?: string; endTime?: string; isFullDay: boolean; reason?: string }) =>
    request<TimeOff>('/time-off', { method: 'POST', body: { ...body, isRecurring: false, isApproved: true } }),
  deleteTimeOff: (id: Id) => request<void>(`/time-off/${id}`, { method: 'DELETE' }),

  /** GET /api/sales/business/{id}?date= */
  sales: (b: Id, d: Date) => request<Sale[]>(`/sales/business/${b}?date=${day(d)}`),

  /** GET/POST /api/businesses/{b}/messages/conversations */
  conversations: (b: Id) => request<InboxSummary[]>(`/businesses/${b}/messages/conversations`),
  conversation: (b: Id, c: string) => request<InboxThread>(`/businesses/${b}/messages/conversations/${encodeURIComponent(c)}`),
  replyConversation: (b: Id, c: string, body: string) =>
    request<InboxMessage>(`/businesses/${b}/messages/conversations/${encodeURIComponent(c)}/messages`, { method: 'POST', body: { body } }),
  /** GET /api/public/studios/{b}/services/{s}/slots?date&staffId -> { availableSlots: string[] } */
  slots: (b: Id, serviceId: Id, date: Date, staffId?: Id) =>
    request<{ availableSlots: string[]; durationMinutes: number }>(
      `/public/studios/${b}/services/${serviceId}/slots?date=${day(date)}${staffId ? `&staffId=${staffId}` : ''}`,
      { auth: false },
    ),

  /** GET /api/bookings/business/{id}/clients (with stats) */
  clientsWithStats: (b: Id) =>
    request<ClientWithStats[]>(`/bookings/business/${b}/clients?limit=1000&offset=0`),
  /** GET /api/clients/business/{id} */
  clients: (b: Id) => request<Client[]>(`/clients/business/${b}`),
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

  /** GET /api/waitlist/business/{id} */
  waitlist: (b: Id) => request<WaitlistEntry[]>(`/waitlist/business/${b}`),
  /** GET /api/businesses/{id}/day-sheet?date= */
  daySheet: (b: Id, date: Date) =>
    request<DaySheet>(`/businesses/${b}/day-sheet?date=${day(date)}`),

  /** POST /api/notifications/device-tokens - platform must be IOS | ANDROID | WEB. */
  registerDeviceToken: (token: string) =>
    request<unknown>('/notifications/device-tokens', {
      method: 'POST',
      body: { token, platform: Platform.OS === 'ios' ? 'IOS' : Platform.OS === 'android' ? 'ANDROID' : 'WEB' },
    }),
};
