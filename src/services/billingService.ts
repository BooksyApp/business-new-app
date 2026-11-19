import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

/**
 * The owner's billing: booqi plan, invoices, marketplace commission and message packs.
 * Everything hangs off /businesses/{id}/billing, which the server restricts to the owner.
 */

export type SubscriptionState = "NONE" | "TRIALING" | "ACTIVE" | "PAST_DUE" | "CANCELLED" | "INCOMPLETE";

export interface BillingSubscription {
  status: SubscriptionState;
  planKey: string | null;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  trialEnd: string | null;
  pastDue: boolean;
  pastDueSince: string | null;
  graceUntil: string | null;
  /** Past the grace period: the account is limited until the payment goes through. */
  restricted: boolean;
  actionRequired: boolean;
}

export interface BillingPlan {
  id: Id;
  planKey: string;
  nameAz: string;
  nameEn: string;
  nameRu: string;
  monthlyPrice: number;
  currency: string;
  /** True when this salon has its own price; monthlyPrice is then the effective one. */
  overridden?: boolean;
  defaultPrice?: number;
  defaultCurrency?: string;
  trialDays: number;
  maxStaff: number | null;
  features: { az: string[]; en: string[]; ru: string[] };
}

export interface NextInvoice {
  date: string;
  planAmount: number;
  commissionAmount: number;
  total: number;
  currency: string;
  /** True while the commission part is still accruing. */
  estimate: boolean;
}

export interface PendingCharge {
  id: Id;
  description: string;
  amount: number;
  currency: string;
  promotionDays: number | null;
  status: "PENDING";
  createdAt: string;
}

export type MessageChannel = "WHATSAPP" | "SMS";

export interface BillingOverview {
  providerEnabled: boolean;
  country: string | null;
  graceDays: number;
  subscription: BillingSubscription;
  plan: BillingPlan | null;
  plans: BillingPlan[];
  nextInvoice: NextInvoice | null;
  messageBalances: Partial<Record<MessageChannel, number>>;
  commissionPct: number;
  pendingCharges?: PendingCharge[];
}

export interface SubscriptionChange {
  action: "CHECKOUT" | "CHANGED" | "FREE_ACTIVATED" | "CANCEL_SCHEDULED";
  checkoutUrl?: string;
  upgrade?: boolean;
}

export interface BillingInvoice {
  id: Id;
  number: string | null;
  status: "DRAFT" | "OPEN" | "PAID" | "VOID" | "UNCOLLECTIBLE";
  amountDue: number;
  amountPaid: number;
  currency: string;
  periodStart: string | null;
  periodEnd: string | null;
  hostedUrl: string | null;
  pdfUrl: string | null;
  createdAt: string;
  paidAt: string | null;
}

export interface CommissionMonth {
  month: string;
  pct: number;
  bookings: number;
  base: number;
  commission: number;
  currency: string;
}

export interface CommissionStatement extends CommissionMonth {
  id: Id;
  status: "PENDING" | "INVOICED";
  invoiceMode: string | null;
}

export interface CommissionOverview {
  currentMonth: CommissionMonth;
  statements: CommissionStatement[];
}

export interface CommissionLine {
  date: string;
  price: number;
  commission: number;
}

export interface MessagePack {
  id: Id;
  channel: MessageChannel;
  nameAz: string;
  nameEn: string;
  nameRu: string;
  quantity: number;
  price: number;
  currency: string;
  overridden?: boolean;
  defaultPrice?: number;
  defaultCurrency?: string;
}

export interface MessagePurchase {
  id: Id;
  channel: MessageChannel;
  quantity: number;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  paidAt: string | null;
}

export interface MessagesOverview {
  balances: Partial<Record<MessageChannel, number>>;
  packs: MessagePack[];
  purchases: MessagePurchase[];
}

const base = (businessId: Id) => `/businesses/${businessId}/billing`;

export const billingService = {
  overview: (businessId: Id) => apiClient.get<BillingOverview>(base(businessId)),

  changeSubscription: (businessId: Id, planId: Id, successUrl: string, cancelUrl: string) =>
    apiClient.post<SubscriptionChange>(`${base(businessId)}/subscription`, { planId, successUrl, cancelUrl }),

  cancelSubscription: (businessId: Id) => apiClient.post<unknown>(`${base(businessId)}/subscription/cancel`, {}),

  resumeSubscription: (businessId: Id) => apiClient.post<unknown>(`${base(businessId)}/subscription/resume`, {}),

  invoices: (businessId: Id) => apiClient.get<BillingInvoice[]>(`${base(businessId)}/invoices`),

  commissions: (businessId: Id) => apiClient.get<CommissionOverview>(`${base(businessId)}/commissions`),

  commissionLines: (businessId: Id, month: string) =>
    apiClient.get<CommissionStatement & { lines: CommissionLine[] }>(`${base(businessId)}/commissions/${month}`),

  messages: (businessId: Id) => apiClient.get<MessagesOverview>(`${base(businessId)}/messages`),

  purchaseMessages: (businessId: Id, packId: Id, successUrl: string, cancelUrl: string) =>
    apiClient.post<{ checkoutUrl: string }>(`${base(businessId)}/messages/purchase`, { packId, successUrl, cancelUrl }),

  charges: (businessId: Id) => apiClient.get<PendingCharge[]>(`${base(businessId)}/charges`),

  payCharge: (businessId: Id, chargeId: Id, successUrl: string, cancelUrl: string) =>
    apiClient.post<{ checkoutUrl: string }>(`${base(businessId)}/charges/${chargeId}/pay`, { successUrl, cancelUrl }),
};
