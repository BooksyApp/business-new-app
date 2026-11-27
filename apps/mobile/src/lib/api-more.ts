import type { Id } from '@booqi/business-shared';
import { request, requestList } from '@/lib/api';

/** Endpoints for group classes, client packages, WhatsApp reminders, CSV import, combos, promotion, suppliers and stock count (same paths/bodies as the old web hub). */
const B = (b: Id) => `/businesses/${b}`;

export interface ClientPackage { id: Id; package_id: Id; package_name: string; service_id: Id | null; sessions_total: number; sessions_remaining: number; expires_at: string | null; purchased_at: string }
export interface WaRow { id: string; clientName?: string; phone?: string | null; serviceName?: string; staffName?: string; startTime: string; text: string; waUrl?: string | null; sentAt?: string | null }
export interface ImportRow { name?: string; firstName?: string; lastName?: string; phone?: string; email?: string; birthday?: string; note?: string; tags?: string }
export type ImportStatus = 'NEW' | 'MERGE_EXISTING' | 'MERGE_IN_FILE' | 'ERROR';
export interface ImportOutcome { row: number; status: ImportStatus; reason: string | null; name: string | null; phone: string | null; email: string | null; matchedName: string | null }
export interface ImportPlan { rows: ImportOutcome[]; counts: Record<ImportStatus, number> }
export interface ComboStep { position?: number; serviceId: Id; serviceName?: string; staffId?: Id | null; staffName?: string | null; parallel?: boolean; durationMinutes?: number; price?: number }
export interface Combo { serviceId: Id; maxPartySize: number; steps: ComboStep[]; totalDurationMinutes: number; totalPrice: number }
export interface PackageSlots { date: string; name: string; partySize: number; maxPartySize: number; durationMinutes: number; availableSlots: string[]; price: number }
export interface PromoPackage { id: Id; nameAz?: string; nameEn?: string; nameRu?: string; days: number; price: number; currency: string | null; forecastKnown: boolean; forecastPerDay: number }
export interface PromoQuote { enabled: boolean; currency: string | null; alreadyRunning: boolean; packages: PromoPackage[] }
export interface PromoRow { id: Id; startsAt: string; endsAt: string; days: number; amount: number; currency: string | null; source: 'PAID' | 'FREE_GRANT'; status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'ENDED' | 'CANCELLED'; impressions: number; clicks: number; bookings: number; ctr: number | null; daysLeft: number; spentAmount: number }
export interface Supplier { id: Id; name: string; contact_name?: string | null; email?: string | null; phone?: string | null; account_number?: string | null; notes?: string | null; is_active?: boolean }
export interface PurchaseOrder { id: Id; reference?: string | null; status: 'DRAFT' | 'ORDERED' | 'RECEIVED' | 'CANCELLED' | string; ordered_on?: string | null; expected_on?: string | null; total_amount?: number | null; supplier_name?: string | null; lines?: number | OrderLine[] }
export interface OrderLine { id: Id; product_id: Id; product_name: string; sku?: string | null; quantity: number; received: number; unit_cost: number }
export interface SuggestLine { product_id: Id; name: string; sku?: string | null; quantity_on_hand: number; low_stock_threshold: number; suggested: number }
export interface StockLevel { id: Id; name: string; sku?: string | null; quantity_on_hand: number; low_stock_threshold?: number | null }

export const apiM = {
  // client packages (prepaid sessions)
  clientPackages: (clientId: Id) => requestList<ClientPackage>(`/packages/client/${clientId}`),
  buyPackage: (b: Id, clientId: Id, packageId: Id) => request<ClientPackage>(`/packages/business/${b}/buy`, { method: 'POST', body: { clientId, packageId } }),
  // client delete + import
  importPreview: (b: Id, rows: ImportRow[]) => request<ImportPlan>(`/clients/business/${b}/import/preview`, { method: 'POST', body: { rows } }),
  importRun: (b: Id, rows: ImportRow[]) => request<ImportPlan>(`/clients/business/${b}/import`, { method: 'POST', body: { rows } }),
  // WhatsApp reminders
  waList: (b: Id, date?: string) => request<{ date: string; rows: WaRow[] }>(`${B(b)}/whatsapp-reminders${date ? `?date=${encodeURIComponent(date)}` : ''}`),
  waMark: (b: Id, appointmentId: string, sent: boolean) => request<void>(`${B(b)}/whatsapp-reminders/${appointmentId}`, { method: 'PUT', body: { sent } }),
  // combos (visit packages)
  combos: (b: Id) => requestList<Combo>(`/services/business/${b}/packages`),
  saveCombo: (serviceId: Id, businessId: Id, maxPartySize: number, steps: { serviceId: Id; staffId?: Id | null; parallel?: boolean }[]) =>
    request<Combo | { serviceId: Id; steps: [] }>(`/services/${serviceId}/package`, { method: 'PUT', body: { businessId, maxPartySize, steps } }),
  comboSlots: (b: Id, serviceId: Id, date: string, partySize: number) => request<PackageSlots>(`/bookings/package/slots?businessId=${encodeURIComponent(String(b))}&serviceId=${encodeURIComponent(String(serviceId))}&date=${date}&partySize=${partySize}`),
  bookCombo: (body: { businessId: Id; serviceId: Id; partySize: number; guestNames?: string[]; clientId?: Id; clientName?: string; clientPhone?: string; appointmentDate: string; startTime: string; notes?: string }, override?: boolean) =>
    request<{ visitId: string; partySize: number; price: number; startTime: string; endTime: string }>('/bookings/package', { method: 'POST', body: override ? { ...body, override: { confirm: true } } : body }),
  // marketplace promotion
  promoQuote: (b: Id) => request<PromoQuote>(`${B(b)}/promotion`),
  promoHistory: (b: Id) => requestList<PromoRow>(`${B(b)}/promotion/history`),
  promoBuy: (b: Id, packageId: Id) => request<{ id: Id; amount: number; currency: string | null; endsAt: string }>(`${B(b)}/promotion`, { method: 'POST', body: { packageId } }),
  promoCheckout: (b: Id, id: Id, successUrl: string, cancelUrl: string) => request<{ checkoutUrl: string }>(`${B(b)}/promotion/${id}/checkout`, { method: 'POST', body: { successUrl, cancelUrl } }),
  promoPause: (b: Id, id: Id) => request<unknown>(`${B(b)}/promotion/${id}/pause`, { method: 'POST', body: {} }),
  promoResume: (b: Id, id: Id) => request<unknown>(`${B(b)}/promotion/${id}/resume`, { method: 'POST', body: {} }),
  promoDiscard: (b: Id, id: Id) => request<unknown>(`${B(b)}/promotion/${id}/discard`, { method: 'POST', body: {} }),
  marketplace: (b: Id) => request<{ promoted: boolean; daily: { date: string; bookings: number }[] }>(`${B(b)}/marketplace-promotion`),
  // suppliers + stock count
  suppliers: (b: Id) => requestList<Supplier>(`${B(b)}/suppliers`),
  saveSupplier: (b: Id, id: Id | null, body: { name: string; contactName?: string; email?: string; phone?: string; accountNumber?: string; notes?: string; isActive?: boolean }) =>
    request<Supplier>(id == null ? `${B(b)}/suppliers` : `${B(b)}/suppliers/${id}`, { method: id == null ? 'POST' : 'PUT', body }),
  orders: (b: Id) => requestList<PurchaseOrder>(`${B(b)}/purchase-orders`),
  orderSuggest: (b: Id) => requestList<SuggestLine>(`${B(b)}/purchase-orders/suggest`),
  order: (b: Id, id: Id) => request<PurchaseOrder & { lines: OrderLine[] }>(`${B(b)}/purchase-orders/${id}`),
  orderCreate: (b: Id, body: { supplierId: Id | null; reference?: string; lines: { productId: Id; quantity: number; unitCost: number }[] }) => request<PurchaseOrder>(`${B(b)}/purchase-orders`, { method: 'POST', body }),
  orderMark: (b: Id, id: Id) => request<PurchaseOrder>(`${B(b)}/purchase-orders/${id}/order`, { method: 'POST', body: {} }),
  orderReceive: (b: Id, id: Id, lines: { lineId: Id; quantity: number }[]) => request<PurchaseOrder>(`${B(b)}/purchase-orders/${id}/receive`, { method: 'POST', body: { lines } }),
  stockLevels: (b: Id) => requestList<StockLevel>(`${B(b)}/stock/levels`),
  stockCount: (b: Id, productId: Id, counted: number, note?: string) => request<unknown>(`${B(b)}/stock/count`, { method: 'POST', body: { productId, counted, note } }),
  // time off with recurrence
  createRecurringTimeOff: (body: { businessId: Id; staffId: Id; startDate: string; endDate: string; startTime?: string; endTime?: string; isFullDay: boolean; reason?: string; recurrencePattern: 'DAILY' | 'WEEKLY' | 'BIWEEKLY'; recurrenceEndDate: string }) =>
    request<unknown>('/time-off', { method: 'POST', body: { ...body, isRecurring: true, isApproved: true } }),
};
