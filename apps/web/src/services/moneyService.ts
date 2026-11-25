import type { Id } from "@/types/id";
import { apiClient } from '@/config/api';

/**
 * Everything a salon does with money after Stripe stops caring: payouts, tips, the cash
 * drawer, invoices, VAT and kept deposits.
 *
 * All of it hangs off /businesses/{id}/… because that prefix is already tenant-checked on
 * the server — one salon cannot read another's takings through these routes.
 */

// ---------------------------------------------------------------- settings

export interface MoneySettings {
  tax_rate: number;
  prices_include_tax: boolean;
  tax_number: string | null;
  legal_name: string | null;
  legal_address: string | null;
  currency: string | null;
  tips_enabled: boolean;
  tip_presets: string;
  payout_iban: string | null;
  payout_account_name: string | null;
  payout_day_of_week: number;
  platform_fee_percent: number | null;
}

export interface MoneySettingsUpdate {
  taxRatePercent?: number;
  pricesIncludeTax?: boolean;
  taxNumber?: string;
  legalName?: string;
  legalAddress?: string;
  currency?: string;
  tipsEnabled?: boolean;
  tipPresets?: string;
  payoutIban?: string;
  payoutAccountName?: string;
  payoutDayOfWeek?: number;
}

// ---------------------------------------------------------------- payouts

export type PayoutStatus = 'PENDING' | 'IN_TRANSIT' | 'PAID' | 'FAILED';

export interface PayoutBatch {
  id: Id;
  period_start: string;
  period_end: string;
  currency: string | null;
  gross_amount: number;
  refund_amount: number;
  fee_amount: number;
  net_amount: number;
  status: PayoutStatus;
  expected_on: string | null;
  paid_at: string | null;
  reference: string | null;
  items?: PayoutItem[];
}

export interface PayoutItem {
  id: Id;
  booking_id: string | null;
  refund_id: Id | null;
  kind: 'SALE' | 'REFUND' | 'FEE' | 'ADJUSTMENT';
  description: string;
  amount: number;
  occurred_on: string;
}

export interface PayoutOverview {
  currency: string | null;
  feePercent: number;
  bank: { payout_iban: string | null; payout_account_name: string | null; payout_day_of_week: number };
  pending: {
    gross: number;
    refunds: number;
    fee: number;
    net: number;
    periodStart: string;
    periodEnd: string;
    expectedOn: string;
  };
  batches: PayoutBatch[];
  totals: { paid: number; on_the_way: number; fees: number };
}

// ---------------------------------------------------------------- tips

export interface TipSummary {
  totals: { total: number; outstanding: number; cash: number; card: number; lines: number };
  byStaff: Array<{
    staff_id: Id | null;
    staff_name: string | null;
    earned: number;
    outstanding: number;
    lines: number;
  }>;
}

export interface TipLine {
  id: Id;
  sale_id: Id | null;
  booking_id: string | null;
  staff_id: Id | null;
  staff_name: string | null;
  amount: number;
  method: string;
  paid_out: boolean;
  paid_out_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------- cash drawer

export interface DrawerMovement {
  id: Id;
  direction: 'IN' | 'OUT';
  amount: number;
  reason: string | null;
  created_at: string;
}

export interface DrawerSession {
  id: Id;
  opened_at: string;
  closed_at: string | null;
  opening_float: number;
  expected_cash: number | null;
  counted_cash: number | null;
  variance: number | null;
  status: 'OPEN' | 'CLOSED';
  notes: string | null;
  /** Only on the live session — what should be in the drawer right now. */
  expected?: number;
  movements?: DrawerMovement[];
}

// ---------------------------------------------------------------- invoices

export interface InvoiceSummary {
  id: Id;
  number: string;
  issued_on: string;
  buyer_name: string | null;
  currency: string | null;
  net_amount: number;
  tax_amount: number;
  gross_amount: number;
  status: 'ISSUED' | 'VOID';
}

export interface InvoiceLine {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  taxRate: number;
  taxAmount: number | null;
}

export interface Invoice extends InvoiceSummary {
  sale_id: Id | null;
  seller_name: string | null;
  seller_address: string | null;
  seller_tax_no: string | null;
  buyer_address: string | null;
  buyer_tax_no: string | null;
  buyer_email: string | null;
  tax_rate: number;
  lines: string | null;
  voided_reason: string | null;
}

// ---------------------------------------------------------------- deposits

export interface ForfeitCandidate {
  id: string;
  appointment_date: string;
  start_time: string;
  status: string;
  deposit_amount: number;
  client_name: string | null;
  client_phone: string | null;
  staff_name: string | null;
}

export interface ForfeitReport {
  totals: { kept: number; bookings: number };
  uncovered: { bookings: number; lost: number };
  kept: Array<{
    id: Id;
    appointment_date: string;
    client_name: string | null;
    amount: number;
    reason: string | null;
    deposit_forfeited_at: string;
  }>;
}

// ----------------------------------------------------------------

const range = (from?: string, to?: string) => {
  const params = new URLSearchParams();
  if (from) params.set('from', from);
  if (to) params.set('to', to);
  const query = params.toString();
  return query ? `?${query}` : '';
};

export const moneyService = {
  // settings
  getSettings: (businessId: Id) =>
    apiClient.get<MoneySettings>(`/businesses/${businessId}/money-settings`),
  updateSettings: (businessId: Id, body: MoneySettingsUpdate) =>
    apiClient.put<MoneySettings>(`/businesses/${businessId}/money-settings`, body),

  // payouts
  getPayouts: (businessId: Id) =>
    apiClient.get<PayoutOverview>(`/businesses/${businessId}/payouts`),
  getPayout: (businessId: Id, batchId: Id) =>
    apiClient.get<PayoutBatch>(`/businesses/${businessId}/payouts/${batchId}`),
  closePayoutPeriod: (businessId: Id, periodStart: string, periodEnd: string) =>
    apiClient.post<PayoutBatch>(
      `/businesses/${businessId}/payouts/close?periodStart=${periodStart}&periodEnd=${periodEnd}`,
      {},
    ),

  // tips
  getTips: (businessId: Id, from?: string, to?: string) =>
    apiClient.get<TipSummary>(`/businesses/${businessId}/tips${range(from, to)}`),
  getTipLines: (businessId: Id, staffId?: Id, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (staffId) params.set('staffId', String(staffId));
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    return apiClient.get<TipLine[]>(`/businesses/${businessId}/tips/lines${query ? `?${query}` : ''}`);
  },
  payOutTips: (businessId: Id, staffId?: Id, upTo?: string) =>
    apiClient.post<{ staffId: Id | null; amount: number; lines: number }>(
      `/businesses/${businessId}/tips/payout`,
      { staffId: staffId ?? null, upTo: upTo ?? null },
    ),

  // cash drawer
  getDrawer: (businessId: Id) =>
    apiClient.get<DrawerSession | null>(`/businesses/${businessId}/cash-drawer`),
  getDrawerHistory: (businessId: Id, limit = 30) =>
    apiClient.get<DrawerSession[]>(`/businesses/${businessId}/cash-drawer/history?limit=${limit}`),
  openDrawer: (businessId: Id, openingFloat: number, staffId?: Id) =>
    apiClient.post<DrawerSession>(`/businesses/${businessId}/cash-drawer/open`, {
      openingFloat,
      staffId: staffId ?? null,
    }),
  closeDrawer: (businessId: Id, sessionId: Id, countedCash: number, notes?: string) =>
    apiClient.post<DrawerSession>(`/businesses/${businessId}/cash-drawer/${sessionId}/close`, {
      countedCash,
      notes: notes ?? null,
    }),
  moveCash: (
    businessId: Id,
    sessionId: Id,
    direction: 'IN' | 'OUT',
    amount: number,
    reason: string,
  ) =>
    apiClient.post<{ expected: number }>(
      `/businesses/${businessId}/cash-drawer/${sessionId}/movements`,
      { direction, amount, reason },
    ),

  // invoices
  getInvoices: (businessId: Id, from?: string, to?: string) =>
    apiClient.get<InvoiceSummary[]>(`/businesses/${businessId}/invoices${range(from, to)}`),
  getInvoice: (businessId: Id, invoiceId: Id) =>
    apiClient.get<Invoice>(`/businesses/${businessId}/invoices/${invoiceId}`),
  issueInvoice: (
    businessId: Id,
    saleId: Id,
    buyer?: { buyerName?: string; buyerAddress?: string; buyerTaxNumber?: string; buyerEmail?: string },
  ) => apiClient.post<Invoice>(`/businesses/${businessId}/invoices`, { saleId, ...(buyer ?? {}) }),
  voidInvoice: (businessId: Id, invoiceId: Id, reason: string) =>
    apiClient.post<Invoice>(`/businesses/${businessId}/invoices/${invoiceId}/void`, { reason }),

  // kept deposits
  getForfeits: (businessId: Id, from?: string, to?: string) =>
    apiClient.get<ForfeitReport>(`/businesses/${businessId}/deposit-forfeits${range(from, to)}`),
  getForfeitCandidates: (businessId: Id) =>
    apiClient.get<ForfeitCandidate[]>(`/businesses/${businessId}/deposit-forfeits/eligible`),
  keepDeposit: (businessId: Id, bookingId: string, reason: string) =>
    apiClient.post<{ amount: number }>(`/businesses/${businessId}/deposit-forfeits/${bookingId}`, { reason }),
  releaseDeposit: (businessId: Id, bookingId: string) =>
    apiClient.delete<{ released: boolean }>(`/businesses/${businessId}/deposit-forfeits/${bookingId}`),
};

/**
 * Refunds. The endpoint has existed since deposits were built and nothing in this app
 * ever called it, so issuing one meant opening the Stripe dashboard — outside every
 * record this system keeps.
 */
export const refundService = {
  /** Omit the amount for a full refund of the booking price. */
  refund: (bookingId: string, amount?: number, reason?: string) =>
    apiClient.post<{
      bookingId: string;
      amount: number;
      stripeRefundId: string | null;
      reason: string | null;
      status: string;
    }>(`/payments/refund/${bookingId}`, { amount: amount ?? null, reason: reason ?? null }),
};

/** FG-W6-04: a payment link (and QR) for a booking. The amount is the server's, never sent. */
export const paymentLinkService = {
  create: (bookingId: string) =>
    apiClient.post<{ id: string; url: string; amount: number; currency: string; expiresAt: string; status: string }>(
      `/payments/link/${bookingId}`,
      {},
    ),
};
