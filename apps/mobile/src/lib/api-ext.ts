import type { Id } from '@booqi/business-shared';
import { request, toDay } from '@/lib/api';

/** Endpoints beyond the calendar core, same paths and bodies as the web hub (old-web-before-reset services). */

export interface Category { id: Id; name: string; description?: string; color?: string; isVisible: boolean; serviceCount?: number }
export interface ServiceFull {
  id: Id; categoryId?: Id | null; categoryName?: string; name: string; description?: string; durationMinutes?: number; price?: number;
  priceType?: 'FIXED' | 'FROM' | 'RANGE'; isActive: boolean; isVisible?: boolean; staffIds?: Id[]; depositPercent?: number | null;
  paddingBefore?: number; paddingAfter?: number; bookingInterval?: number; parallelClients?: number; mobileService?: boolean; taxRate?: number | null;
  messageToClient?: string | null;
}
export interface ServiceBody {
  categoryId?: Id | null; name?: string; description?: string; durationMinutes?: number; price?: number; priceType?: 'FIXED' | 'FROM' | 'RANGE';
  staffIds?: Id[]; isVisible?: boolean; isActive?: boolean; depositPercent?: number | null; paddingBefore?: number; paddingAfter?: number;
  bookingInterval?: number; parallelClients?: number; mobileService?: boolean; taxRate?: number | null; messageToClient?: string | null;
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
export interface SaleItemBody { serviceId?: Id; serviceName: string; serviceType: string; quantity: number; unitPrice: number }
export interface SaleBody {
  businessId: Id; staffId?: Id; clientId?: Id; clientName?: string; items: SaleItemBody[]; discountAmount?: number; tipAmount?: number;
  paymentMethod: 'CASH' | 'CARD_TERMINAL' | 'GIFT_CARD' | 'MEMBERSHIP' | 'PACKAGE'; paymentAmount: number; giftCardCode?: string; notes?: string;
}
export interface SaleRefund { saleId: Id; refundable?: number; remaining?: number; refunds?: unknown[] }
export interface Dashboard {
  kpis: Record<string, { value: number; previous: number }>;
  topServices: { name: string; bookings: number; revenue: number }[];
  staff: { name: string; visits: number; revenue: number; utilization: number | null }[];
  sources: { source: string; bookings: number }[];
}
export interface HoursRow { dayOfWeek: string; enabled: boolean; startTime: string | null; endTime: string | null }
export interface NotifSettings {
  emailConfirmation: boolean; emailReminder: boolean; emailCancellation: boolean; emailReschedule: boolean; emailWaitlist: boolean; emailReviewRequest: boolean;
  salonAlerts?: boolean; reminderHoursBefore: number; smsEnabled: boolean; pushEnabled: boolean; whatsappEnabled?: boolean; smsAvailable?: boolean; pushAvailable?: boolean; whatsappAvailable?: boolean;
  senderName: string | null; replyTo: string | null;
}
export interface Look { id: Id; photoUrl: string; title?: string | null; serviceName?: string | null; status: string }
export interface Story { id: Id; url: string; caption?: string | null; viewCount: number; expiresAt: string }
export interface ConsentForm { id: Id; name?: string; title?: string; isActive?: boolean }
export interface SubStatus { plan?: string; status?: string; trialEndsAt?: string | null; currentPeriodEnd?: string | null }
export interface ClientBody { firstName?: string; lastName?: string; phone?: string; email?: string; notes?: string; allowMarketingEmails?: boolean; allowSmsNotifications?: boolean }

const q = (o: Record<string, string>) => new URLSearchParams(o).toString();

export const apiX = {
  // categories
  categories: (b: Id) => request<Category[]>(`/categories/business/${b}`),
  createCategory: (b: Id, body: { name: string; description?: string; color?: string }) => request<Category>(`/categories/business/${b}`, { method: 'POST', body }),
  updateCategory: (b: Id, id: Id, body: { name?: string; isVisible?: boolean }) => request<Category>(`/categories/${id}/business/${b}`, { method: 'PUT', body }),
  deleteCategory: (b: Id, id: Id) => request<void>(`/categories/${id}/business/${b}`, { method: 'DELETE' }),
  // services
  servicesFull: (b: Id) => request<ServiceFull[]>(`/services/business/${b}`),
  createService: (b: Id, body: ServiceBody) => request<ServiceFull>(`/services/business/${b}`, { method: 'POST', body }),
  updateServiceFull: (b: Id, id: Id, body: ServiceBody) => request<ServiceFull>(`/services/${id}/business/${b}`, { method: 'PUT', body }),
  archiveService: (b: Id, id: Id) => request<void>(`/services/${id}/business/${b}`, { method: 'DELETE' }),
  archivedServices: (b: Id) => request<ServiceFull[]>(`/services/business/${b}/archived`),
  restoreService: (b: Id, id: Id) => request<ServiceFull>(`/services/${id}/business/${b}/restore`, { method: 'PUT', body: {} }),
  packages: (b: Id) => request<{ id: Id; name?: string; serviceName?: string; sessions?: number; price?: number; active?: boolean }[]>(`/packages/business/${b}`),
  // staff
  staffFull: (b: Id) => request<StaffFull[]>(`/staff/business/${b}`),
  createStaff: (b: Id, body: StaffBody) => request<StaffFull>(`/staff/business/${b}`, { method: 'POST', body }),
  updateStaff: (b: Id, id: Id, body: StaffBody) => request<StaffFull>(`/staff/${id}/business/${b}`, { method: 'PUT', body }),
  inviteStaff: (id: Id) => request<void>(`/staff/${id}/invite`, { method: 'POST', body: {} }),
  setStaffRole: (id: Id, role: string) => request<unknown>(`/staff/${id}/role`, { method: 'PUT', body: { role } }),
  timeOffForStaff: (b: Id, s: Id) => request<{ id: Id; startDate: string; endDate: string; isFullDay: boolean; reason?: string | null; isApproved?: boolean }[]>(`/time-off/staff/${s}`),
  // waitlist
  addWaitlist: (b: Id, body: WaitlistAdd) => request<{ id: Id }>(`/waitlist/business/${b}`, { method: 'POST', body }),
  removeWaitlist: (b: Id, id: Id) => request<void>(`/waitlist/business/${b}/${id}`, { method: 'DELETE' }),
  offerWaitlist: (b: Id, id: Id, slots: { staffId: Id; date: string; startTime: string }[]) => request<void>(`/waitlist/business/${b}/${id}/offer`, { method: 'POST', body: { slots } }),
  // clients
  updateClient: (id: Id, body: ClientBody) => request<unknown>(`/clients/${id}`, { method: 'PUT', body }),
  consentForms: (b: Id) => request<ConsentForm[]>(`/consent-forms/business/${b}`),
  clientConsents: (id: Id) => request<{ id: Id; formName?: string; signedAt?: string; createdAt?: string }[]>(`/clients/${id}/consent-submissions`),
  // sales
  createSale: (body: SaleBody) => request<{ id: Id; total: number }>('/sales', { method: 'POST', body }),
  refundSummary: (id: Id) => request<SaleRefund>(`/sales/${id}/refunds`),
  refundSale: (id: Id, body: { amount: number; reason?: string }) => request<unknown>(`/sales/${id}/refunds`, { method: 'POST', body }),
  salesRange: (b: Id, from: Date, to: Date) => request<{ total: number; tipAmount?: number; paymentMethod: string }[]>(`/sales/business/${b}?${q({ startDate: toDay(from), endDate: toDay(to) })}`),
  // reviews
  reviews: (b: Id) => request<Review[]>(`/reviews/business/${b}`),
  reviewSummary: (b: Id) => request<{ count: number; average: number | null }>(`/reviews/business/${b}/summary`),
  replyReview: (b: Id, id: Id, reply: string) => request<Review>(`/businesses/${b}/reviews/${id}/reply`, { method: 'PUT', body: { reply } }),
  reportReview: (b: Id, id: Id, reason: string, comment: string) => request<{ status: string }>(`/businesses/${b}/reviews/${id}/report`, { method: 'POST', body: { reason, comment } }),
  // analytics
  dashboard: (b: Id, from: Date, to: Date) => request<Dashboard>(`/analytics/business/${b}/dashboard?${q({ startDate: toDay(from), endDate: toDay(to) })}`),
  // settings
  hours: (b: Id) => request<HoursRow[]>(`/business-hours/business/${b}`),
  saveHours: (b: Id, rows: { dayOfWeek: string; enabled: boolean; startTime: string; endTime: string }[]) => request<HoursRow[]>(`/business-hours/business/${b}`, { method: 'PUT', body: rows }),
  hoursExceptions: (b: Id) => request<{ id: Id; startDate: string; endDate: string; closed: boolean; notes: string | null }[]>(`/business-hours-exceptions/business/${b}`),
  addHoursException: (b: Id, startDate: string, endDate: string, notes: string) => request<unknown>('/business-hours-exceptions', { method: 'POST', body: { businessId: b, startDate, endDate, closed: true, openTime: null, closeTime: null, notes: notes || null } }),
  removeHoursException: (b: Id, id: Id) => request<void>(`/business-hours-exceptions/${id}?businessId=${b}`, { method: 'DELETE' }),
  hubEvents: (b: Id) => request<{ unread: number; events: { id: string; type: string; at: string; who?: string | null; what?: string | null; date?: string | null; time?: string | null; rating?: number | null; unread: boolean }[] }>(`/businesses/${b}/hub-events`),
  readHubEvents: (b: Id) => request<{ unread: number }>(`/businesses/${b}/hub-events/read`, { method: 'POST', body: {} }),
  notifSettings: (b: Id) => request<NotifSettings>(`/businesses/${b}/notification-settings`),
  saveNotifSettings: (b: Id, body: NotifSettings) => request<NotifSettings>(`/businesses/${b}/notification-settings`, { method: 'PUT', body }),
  subscription: (b: Id) => request<SubStatus>(`/businesses/${b}/subscription`),
  // looks & stories
  looks: (b: Id) => request<Look[]>(`/businesses/${b}/looks`),
  deleteLook: (b: Id, id: Id) => request<void>(`/businesses/${b}/looks/${id}`, { method: 'DELETE' }),
  stories: (b: Id) => request<Story[]>(`/businesses/${b}/stories`),
  deleteStory: (b: Id, id: Id) => request<void>(`/businesses/${b}/stories/${id}`, { method: 'DELETE' }),
};
