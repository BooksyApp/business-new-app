import type { Id } from '@booqi/business-shared';
import { request, requestList, toDay } from '@/lib/api';

/** Endpoints beyond the calendar core, same paths and bodies as the web hub (old-web-before-reset services). */

export interface Category { id: Id; name: string; description?: string; color?: string; isVisible: boolean; serviceCount?: number }
export interface ServiceFull {
  id: Id; categoryId?: Id | null; categoryName?: string; name: string; description?: string; durationMinutes?: number; price?: number;
  priceType?: 'FIXED' | 'FROM' | 'RANGE'; isActive: boolean; isVisible?: boolean; staffIds?: Id[]; depositPercent?: number | null;
  paddingBefore?: number; paddingAfter?: number; bookingInterval?: number; parallelClients?: number; mobileService?: boolean; taxRate?: number | null;
  messageToClient?: string | null;
  isClass?: boolean; maxParticipants?: number | null;
  resourceTypeId?: Id | null; staffOverrides?: { staffId: Id; price?: number | null; durationMinutes?: number | null }[]; serviceType?: string | null; color?: string | null; virtualAppointment?: boolean; processingDuring?: number; processingAfter?: number;
  travelFee?: number | null; serviceArea?: string | null; questions?: { text: string; required?: boolean }[];
}
export interface ServiceBody {
  categoryId?: Id | null; name?: string; description?: string; durationMinutes?: number; price?: number; priceType?: 'FIXED' | 'FROM' | 'RANGE';
  staffIds?: Id[]; isVisible?: boolean; isActive?: boolean; depositPercent?: number | null; paddingBefore?: number; paddingAfter?: number;
  bookingInterval?: number; parallelClients?: number; mobileService?: boolean; taxRate?: number | null; messageToClient?: string | null; isClass?: boolean; maxParticipants?: number | null;
  resourceTypeId?: Id | null; staffOverrides?: { staffId: Id; price?: number | null; durationMinutes?: number | null }[]; availableFrom?: string; availableTo?: string; serviceType?: string; color?: string; virtualAppointment?: boolean; processingDuring?: number; processingAfter?: number; travelFee?: number | null; serviceArea?: string | null; questions?: { text: string; required?: boolean }[];
}
export interface StaffBody { avatarUrl?: string; name?: string; email?: string; phone?: string; position?: string; serviceIds?: Id[]; isActive?: boolean; schedule?: Record<string, string[]>; inviteAndCreateAccount?: boolean }
export interface StaffFull {
  id: Id; name: string; email?: string; phone?: string; position?: string; avatarUrl?: string; role?: string; isActive?: boolean;
  workingHoursStart?: Record<string, string>; workingHoursEnd?: Record<string, string>; serviceIds?: Id[];
}
export interface WaitlistAdd { serviceId: Id; staffId?: Id | null; clientName: string; clientPhone?: string; clientEmail?: string; preferredDate: string; preferredTime?: string }
export interface Review {
  id: Id; rating: number; comment: string | null; createdAt: string; authorName: string | null; reply: string | null; repliedAt: string | null;
  serviceName?: string | null; staffName?: string | null;
}
export interface SaleItemBody { serviceId?: Id; productId?: Id; serviceName: string; serviceType: string; quantity: number; unitPrice: number }
export interface SaleBody {
  businessId: Id; staffId?: Id; clientId?: Id; clientName?: string; items: (SaleItemBody & { coveredBy?: 'MEMBERSHIP' | 'PACKAGE'; appointmentId?: string })[]; discountAmount?: number; tipAmount?: number;
  paymentMethod: 'CASH' | 'CARD_TERMINAL' | 'SPLIT' | 'GIFT_CARD' | 'MEMBERSHIP' | 'PACKAGE'; paymentAmount: number; giftCardCode?: string; notes?: string;
  splitCashAmount?: number; splitCardAmount?: number; payments?: { method: 'CASH' | 'CARD_TERMINAL' | 'GIFT_CARD'; amount: number; giftCardCode?: string }[]; appointmentId?: string; promoCode?: string; idempotencyKey?: string;
}
export interface SaleRefund { saleId: Id; refundable?: number; remaining?: number; refunds?: unknown[] }
export interface Dashboard {
  kpis: Record<string, { value: number; previous: number }>;
  topServices: { name: string; bookings: number; revenue: number }[];
  staff: { name: string; visits: number; revenue: number; utilization: number | null }[];
  sources: { source: string; bookings: number }[];
  /** daily revenue (oldest first), from the API's revenueTrend */
  series?: number[];
}
const num = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v)) ? Number(v) : 0);
const arr = (v: unknown): Record<string, unknown>[] => (Array.isArray(v) ? v.filter((x): x is Record<string, unknown> => !!x && typeof x === 'object') : []);
/** Live /analytics/business/{id}/dashboard returns kpis{key:{value,previous}} (percent KPIs are already 0-100), revenueTrend[{date,revenue,previous}], topServices, staff, sources[{source,bookings}]; any of them can be null or missing. */
export function normDashboard(r: Record<string, unknown> | null): Dashboard {
  const kr = (r?.kpis && typeof r.kpis === 'object' ? r.kpis : {}) as Record<string, { value?: unknown; previous?: unknown } | null>;
  const kpis: Dashboard['kpis'] = {};
  for (const k of Object.keys(kr)) kpis[k] = { value: num(kr[k]?.value), previous: num(kr[k]?.previous) };
  const trend = arr(r?.revenueTrend).map((x) => num(x.revenue));
  return {
    kpis,
    topServices: arr(r?.topServices).map((x) => ({ name: String(x.name ?? '—'), bookings: num(x.bookings), revenue: num(x.revenue) })),
    staff: arr(r?.staff).map((x) => ({ name: String(x.name ?? '—'), visits: num(x.visits), revenue: num(x.revenue), utilization: x.utilization == null ? null : num(x.utilization) })),
    sources: arr(r?.sources).map((x) => ({ source: String(x.source ?? 'other'), bookings: num(x.bookings) })),
    series: trend.length > 1 ? trend : undefined,
  };
}
export interface HoursRow { dayOfWeek: string; enabled: boolean; startTime: string | null; endTime: string | null }
export interface NotifSettings {
  emailConfirmation: boolean; emailReminder: boolean; emailCancellation: boolean; emailReschedule: boolean; emailWaitlist: boolean; emailReviewRequest: boolean;
  salonAlerts?: boolean; reminderHoursBefore: number; smsEnabled: boolean; pushEnabled: boolean; whatsappEnabled?: boolean; smsAvailable?: boolean; pushAvailable?: boolean; whatsappAvailable?: boolean;
  senderName: string | null; replyTo: string | null;
}
/** saveCount: how many customers saved the look (saved_looks); the API sends no view count for looks. */
export interface Look { id: Id; photoUrl: string; title?: string | null; serviceName?: string | null; status: string; saveCount?: number }
export interface Story { id: Id; url: string; caption?: string | null; viewCount: number; expiresAt: string }
export interface ConsentForm { id: Id; name?: string; title?: string; isActive?: boolean }
export interface SubStatus { plan?: string; status?: string; trialEndsAt?: string | null; currentPeriodEnd?: string | null }
export interface ClientBody { firstName?: string; lastName?: string; phone?: string; email?: string; notes?: string; allowMarketingEmails?: boolean; allowSmsNotifications?: boolean; patchTestDate?: string; vip?: boolean }
export interface ClientTag { id: Id; name: string; colour?: string | null }
export interface ClientField { id: Id; name: string; type: 'TEXT' | 'NUMBER' | 'DATE' | 'SELECT'; options?: string[] | null; value?: string | null }

const BZ = (b: Id) => `/businesses/${b}`;
const q = (o: Record<string, string>) => new URLSearchParams(o).toString();

export const apiX = {
  // client tags and custom fields (ClientTagController)
  /** GET /api/clients/{id}/export: everything held about the client (GDPR data export). */
  exportClient: (id: Id) => request<unknown>(`/clients/${id}/export`),
  clientTags: (b: Id) => requestList<ClientTag>(`${BZ(b)}/client-tags`),
  createClientTag: (b: Id, name: string) => request<ClientTag>(`${BZ(b)}/client-tags`, { method: 'POST', body: { name } }),
  clientCrm: (b: Id, c: Id) => request<{ tags: ClientTag[]; blocked: boolean; blockReason: string | null }>(`${BZ(b)}/clients/${c}/crm`),
  setClientTags: (b: Id, c: Id, tagIds: Id[]) => request<unknown>(`${BZ(b)}/clients/${c}/tags`, { method: 'PUT', body: { tagIds } }),
  clientFields: (b: Id, c: Id) => requestList<ClientField>(`${BZ(b)}/clients/${c}/fields`),
  setClientFields: (b: Id, c: Id, values: Record<string, string>) => request<unknown>(`${BZ(b)}/clients/${c}/fields`, { method: 'PUT', body: { values } }),
  // categories
  categories: (b: Id) => requestList<Category>(`/categories/business/${b}`),
  createCategory: (b: Id, body: { name: string; description?: string; color?: string }) => request<Category>(`/categories/business/${b}`, { method: 'POST', body }),
  updateCategory: (b: Id, id: Id, body: { name?: string; isVisible?: boolean }) => request<Category>(`/categories/${id}/business/${b}`, { method: 'PUT', body }),
  deleteCategory: (b: Id, id: Id) => request<void>(`/categories/${id}/business/${b}`, { method: 'DELETE' }),
  // services
  servicesFull: (b: Id) => requestList<ServiceFull>(`/services/business/${b}`),
  createService: (b: Id, body: ServiceBody) => request<ServiceFull>(`/services/business/${b}`, { method: 'POST', body }),
  updateServiceFull: (b: Id, id: Id, body: ServiceBody) => request<ServiceFull>(`/services/${id}/business/${b}`, { method: 'PUT', body }),
  archiveService: (b: Id, id: Id) => request<void>(`/services/${id}/business/${b}`, { method: 'DELETE' }),
  archivedServices: (b: Id) => requestList<ServiceFull>(`/services/business/${b}/archived`),
  restoreService: (b: Id, id: Id) => request<ServiceFull>(`/services/${id}/business/${b}/restore`, { method: 'PUT', body: {} }),
  packages: (b: Id) => requestList<{ id: Id; name?: string; serviceName?: string; sessions?: number; price?: number; active?: boolean }>(`/packages/business/${b}`),
  // staff
  staffFull: (b: Id) => requestList<StaffFull>(`/staff/business/${b}`),
  createStaff: (b: Id, body: StaffBody) => request<StaffFull>(`/staff/business/${b}`, { method: 'POST', body }),
  updateStaff: (b: Id, id: Id, body: StaffBody) => request<StaffFull>(`/staff/${id}/business/${b}`, { method: 'PUT', body }),
  /** GET/PUT /api/services/assignments/business/{b}/staff/{s}: the services a specialist performs (StaffCreateRequest has no serviceIds, the hub saves them here). */
  staffServiceIds: (b: Id, s: Id) => requestList<Id>(`/services/assignments/business/${b}/staff/${s}`),
  setStaffServiceIds: (b: Id, s: Id, serviceIds: Id[]) => requestList<Id>(`/services/assignments/business/${b}/staff/${s}`, { method: 'PUT', body: { serviceIds } }),
  inviteStaff: (id: Id) => request<void>(`/staff/${id}/invite`, { method: 'POST', body: {} }),
  /** PUT /api/staff/{id}/role {roleId}: one of the salon's roles (what the hub does). The {role} tier form still works for OWNER / MANAGER / STAFF. */
  setStaffRoleId: (id: Id, roleId: Id) => request<unknown>(`/staff/${id}/role`, { method: 'PUT', body: { roleId } }),
  setStaffRole: (id: Id, role: string) => request<unknown>(`/staff/${id}/role`, { method: 'PUT', body: { role } }),
  timeOffForStaff: (b: Id, s: Id) => request<{ id: Id; startDate: string; endDate: string; isFullDay: boolean; reason?: string | null; isApproved?: boolean }[]>(`/time-off/staff/${s}`),
  // waitlist
  addWaitlist: (b: Id, body: WaitlistAdd) => request<{ id: Id }>(`/waitlist/business/${b}`, { method: 'POST', body }),
  removeWaitlist: (b: Id, id: Id) => request<void>(`/waitlist/business/${b}/${id}`, { method: 'DELETE' }),
  offerWaitlist: (b: Id, id: Id, slots: { staffId: Id; date: string; startTime: string }[]) => request<void>(`/waitlist/business/${b}/${id}/offer`, { method: 'POST', body: { slots } }),
  // clients
  updateClient: (id: Id, body: ClientBody) => request<unknown>(`/clients/${id}`, { method: 'PUT', body }),
  consentForms: (b: Id) => requestList<ConsentForm>(`/consent-forms/business/${b}`),
  clientConsents: (id: Id) => requestList<{ id: Id; formName?: string; signedAt?: string; createdAt?: string }>(`/clients/${id}/consent-submissions`),
  // sales
  /** POST /api/payment-confirmation: what the hub till calls (spends the gift card, covers lines by membership / package, settles the booking, books commissions). POST /sales does none of that. */
  confirmPayment: (body: SaleBody) => request<{ saleId: Id; totalAmount: number; appointmentUpdated: boolean }>('/payment-confirmation', { method: 'POST', body }),
  refundSummary: (id: Id) => request<SaleRefund>(`/sales/${id}/refunds`),
  refundSale: (id: Id, body: { amount: number; reason?: string }) => request<unknown>(`/sales/${id}/refunds`, { method: 'POST', body }),
  salesRange: (b: Id, from: Date, to: Date) => requestList<{ total: number; tipAmount?: number; paymentMethod: string }>(`/sales/business/${b}?${q({ startDate: toDay(from), endDate: toDay(to) })}`),
  // reviews
  reviews: (b: Id) => requestList<Review>(`/reviews/business/${b}`),
  reviewSummary: (b: Id) => request<{ count?: number; average?: number | string | null } | null>(`/reviews/business/${b}/summary`).then((r) => ({ count: Number(r?.count) || 0, average: r?.average == null || !Number.isFinite(Number(r.average)) ? null : Number(r.average) })),
  replyReview: (b: Id, id: Id, reply: string) => request<Review>(`/businesses/${b}/reviews/${id}/reply`, { method: 'PUT', body: { reply } }),
  reportReview: (b: Id, id: Id, reason: string, comment: string) => request<{ status: string }>(`/businesses/${b}/reviews/${id}/report`, { method: 'POST', body: { reason, comment } }),
  // analytics
  dashboard: (b: Id, from: Date, to: Date) => request<Record<string, unknown> | null>(`/analytics/business/${b}/dashboard?${q({ startDate: toDay(from), endDate: toDay(to), timezone: 'Asia/Baku' })}`).then(normDashboard),
  // settings
  hours: (b: Id) => requestList<HoursRow>(`/business-hours/business/${b}`),
  saveHours: (b: Id, rows: { dayOfWeek: string; enabled: boolean; startTime: string; endTime: string }[]) => requestList<HoursRow>(`/business-hours/business/${b}`, { method: 'PUT', body: rows }),
  hoursExceptions: (b: Id) => request<{ id: Id; startDate: string; endDate: string; closed: boolean; openTime?: string | null; closeTime?: string | null; notes: string | null }[]>(`/business-hours-exceptions/business/${b}`),
  addHoursException: (b: Id, startDate: string, endDate: string, notes: string, hours?: { open: string; close: string }) => request<unknown>('/business-hours-exceptions', { method: 'POST', body: { businessId: b, startDate, endDate, closed: !hours, openTime: hours?.open ?? null, closeTime: hours?.close ?? null, notes: notes || null } }),
  removeHoursException: (b: Id, id: Id) => request<void>(`/business-hours-exceptions/${id}?businessId=${b}`, { method: 'DELETE' }),
  hubEvents: (b: Id) => request<null | { unread: number; events: { id: string; type: string; at: string; who?: string | null; what?: string | null; date?: string | null; time?: string | null; rating?: number | null; unread: boolean }[] }>(`/businesses/${b}/hub-events`).then((r) => ({ unread: Number(r?.unread) || 0, events: Array.isArray(r?.events) ? r.events : [] })),
  readHubEvents: (b: Id) => request<{ unread: number }>(`/businesses/${b}/hub-events/read`, { method: 'POST', body: {} }),
  notifSettings: (b: Id) => request<NotifSettings>(`/businesses/${b}/notification-settings`),
  saveNotifSettings: (b: Id, body: NotifSettings) => request<NotifSettings>(`/businesses/${b}/notification-settings`, { method: 'PUT', body }),
  subscription: (b: Id) => request<SubStatus>(`/businesses/${b}/subscription`),
  // looks & stories
  looks: (b: Id) => requestList<Look>(`/businesses/${b}/looks`),
  deleteLook: (b: Id, id: Id) => request<void>(`/businesses/${b}/looks/${id}`, { method: 'DELETE' }),
  stories: (b: Id) => requestList<Story>(`/businesses/${b}/stories`),
  deleteStory: (b: Id, id: Id) => request<void>(`/businesses/${b}/stories/${id}`, { method: 'DELETE' }),
};
