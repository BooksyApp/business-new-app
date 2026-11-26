import type { Id } from '@booqi/business-shared';
import { request } from '@/lib/api';

/** Endpoints of the hub-parity pass: resource types, staff portfolio, chair rent, calendar feed, loyalty cards, revenue plan, notification texts. Paths and bodies as in business-new-app/apps/web services and booksy-backend controllers. */
const B = (b: Id) => `/businesses/${b}`;

export interface ResourceType { id: Id; name: string; quantity: number; isActive?: boolean }
export interface PortfolioPhoto { id: Id; staffId: Id; url: string; caption: string | null; serviceId: Id | null; position: number }
export interface ChairLedger { rental: { period: 'WEEKLY' | 'MONTHLY'; amount: number; dueDay: number; startsOn: string; active: boolean } | null; overdueCount: number; rows: { dueOn: string; amount: number; status: 'PAID' | 'DUE' | 'OVERDUE'; paidOn?: string | null; method?: string | null }[] }
export interface LoyaltyCard { id: Id; name: string; visits_required: number; reward_service_id: Id | null; reward_service_name: string | null; valid_until: string | null; active: boolean; expired: boolean; color_from: string | null; color_to: string | null; icon: string | null; holders: number; rewards_waiting: number; rewards_used: number }
export interface CardHolder { id: Id; client_id: Id; client_name: string; email: string | null; phone: string | null; stamps: number; rewards_available: number; rewards_used: number }
export interface PlanMonth { month: string; plan: number; actual: number }
export type NotifTexts = Record<'CONFIRMATION' | 'REMINDER' | 'CANCELLATION', Record<'az' | 'en' | 'ru', string>>;

export const apiH = {
  resourceTypes: (b: Id) => request<ResourceType[]>(`/resource-types/business/${b}`),
  addResourceType: (b: Id, name: string, quantity: number) => request<ResourceType>(`/resource-types/business/${b}`, { method: 'POST', body: { businessId: b, name, quantity } }),
  deleteResourceType: (b: Id, id: Id) => request<void>(`/resource-types/business/${b}/${id}`, { method: 'DELETE' }),

  portfolio: (b: Id, s: Id) => request<PortfolioPhoto[]>(`${B(b)}/staff/${s}/portfolio`),
  addPortfolio: (b: Id, s: Id, upload: string, caption?: string, serviceId?: Id | null) => request<PortfolioPhoto>(`${B(b)}/staff/${s}/portfolio`, { method: 'POST', body: { upload, caption: caption?.trim() || null, serviceId: serviceId || null } }),
  updatePortfolio: (b: Id, s: Id, id: Id, caption: string, serviceId: Id | null) => request<PortfolioPhoto>(`${B(b)}/staff/${s}/portfolio/${id}`, { method: 'PUT', body: { caption: caption.trim() || null, serviceId: serviceId || null } }),
  removePortfolio: (b: Id, s: Id, id: Id) => request<void>(`${B(b)}/staff/${s}/portfolio/${id}`, { method: 'DELETE' }),
  reorderPortfolio: (b: Id, s: Id, ids: Id[]) => request<PortfolioPhoto[]>(`${B(b)}/staff/${s}/portfolio/order`, { method: 'PUT', body: { ids } }),

  chairRent: (b: Id, s: Id) => request<ChairLedger>(`/staff/business/${b}/${s}/chair-rent`),
  saveChairRent: (b: Id, s: Id, t: { renter: boolean; period?: 'WEEKLY' | 'MONTHLY'; amount?: number; dueDay?: number; startsOn?: string }) => request<ChairLedger>(`/staff/business/${b}/${s}/chair-rent`, { method: 'PUT', body: t }),
  payChairRent: (b: Id, s: Id, p: { dueOn: string; paidOn: string; method: 'CASH' | 'CARD' | 'TRANSFER' }) => request<ChairLedger>(`/staff/business/${b}/${s}/chair-rent/payments`, { method: 'POST', body: p }),

  feedPath: (s: Id) => request<{ feedPath: string }>(`/calendar/staff/${s}/token`).then((r) => r.feedPath),
  newFeedPath: (s: Id) => request<{ feedPath: string }>(`/calendar/staff/${s}/token/regenerate`, { method: 'POST', body: {} }).then((r) => r.feedPath),

  loyaltyCards: (b: Id) => request<LoyaltyCard[]>(`${B(b)}/loyalty-cards`),
  createCard: (b: Id, body: { name: string; visitsRequired: number; rewardServiceId?: Id | null; validUntil?: string | null; colorFrom?: string; colorTo?: string }) => request<LoyaltyCard & { assignedTo: number }>(`${B(b)}/loyalty-cards`, { method: 'POST', body }),
  endCard: (b: Id, id: Id) => request<void>(`${B(b)}/loyalty-cards/${id}`, { method: 'DELETE' }),
  cardHolders: (b: Id, id: Id) => request<CardHolder[]>(`${B(b)}/loyalty-cards/${id}/holders`),
  addHolder: (b: Id, id: Id, clientId: Id) => request<unknown>(`${B(b)}/loyalty-cards/${id}/holders/${clientId}`, { method: 'POST', body: {} }),
  stamp: (b: Id, id: Id, clientId: Id, delta = 1) => request<unknown>(`${B(b)}/loyalty-cards/${id}/holders/${clientId}/stamp`, { method: 'POST', body: { delta } }),

  plan: (b: Id, year: number) => request<PlanMonth[]>(`${B(b)}/revenue-plan?year=${year}`),
  setPlan: (b: Id, month: string, amount: number) => request<void>(`${B(b)}/revenue-plan/${month}`, { method: 'PUT', body: { amount } }),

  texts: (b: Id) => request<NotifTexts>(`${B(b)}/settings/notification-texts`),
  saveTexts: (b: Id, t: NotifTexts) => request<NotifTexts>(`${B(b)}/settings/notification-texts`, { method: 'PUT', body: t }),
};
