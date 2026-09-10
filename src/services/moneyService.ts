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
  id: number;
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
  id: number;
  booking_id: number | null;
  refund_id: number | null;
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
    staff_id: number | null;
    staff_name: string | null;
    earned: number;
    outstanding: number;
    lines: number;
  }>;
}

export interface TipLine {
  id: number;
  sale_id: number | null;
  booking_id: number | null;
  staff_id: number | null;
  staff_name: string | null;
  amount: number;
  method: string;
  paid_out: boolean;
  paid_out_at: string | null;
  created_at: string;
}

// ---------------------------------------------------------------- cash drawer

export interface DrawerMovement {
  id: number;
  direction: 'IN' | 'OUT';
  amount: number;
  reason: string | null;
  created_at: string;
}

export interface DrawerSession {
  id: number;
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
  id: number;
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
  sale_id: number | null;
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
  id: number;
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
    id: number;
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
  getSettings: (businessId: number) =>
    apiClient.get<MoneySettings>(`/businesses/${businessId}/money-settings`),
  updateSettings: (businessId: number, body: MoneySettingsUpdate) =>
    apiClient.put<MoneySettings>(`/businesses/${businessId}/money-settings`, body),

  // payouts
  getPayouts: (businessId: number) =>
    apiClient.get<PayoutOverview>(`/businesses/${businessId}/payouts`),
  getPayout: (businessId: number, batchId: number) =>
    apiClient.get<PayoutBatch>(`/businesses/${businessId}/payouts/${batchId}`),
  closePayoutPeriod: (businessId: number, periodStart: string, periodEnd: string) =>
    apiClient.post<PayoutBatch>(
      `/businesses/${businessId}/payouts/close?periodStart=${periodStart}&periodEnd=${periodEnd}`,
      {},
    ),

  // tips
  getTips: (businessId: number, from?: string, to?: string) =>
    apiClient.get<TipSummary>(`/businesses/${businessId}/tips${range(from, to)}`),
  getTipLines: (businessId: number, staffId?: number, from?: string, to?: string) => {
    const params = new URLSearchParams();
    if (staffId) params.set('staffId', String(staffId));
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const query = params.toString();
    return apiClient.get<TipLine[]>(`/businesses/${businessId}/tips/lines${query ? `?${query}` : ''}`);
  },
  payOutTips: (businessId: number, staffId?: number, upTo?: string) =>
    apiClient.post<{ staffId: number | null; amount: number; lines: number }>(
      `/businesses/${businessId}/tips/payout`,
      { staffId: staffId ?? null, upTo: upTo ?? null },
    ),

  // cash drawer
  getDrawer: (businessId: number) =>
    apiClient.get<DrawerSession | null>(`/businesses/${businessId}/cash-drawer`),
  getDrawerHistory: (businessId: number, limit = 30) =>
    apiClient.get<DrawerSession[]>(`/businesses/${businessId}/cash-drawer/history?limit=${limit}`),
  openDrawer: (businessId: number, openingFloat: number, staffId?: number) =>
    apiClient.post<DrawerSession>(`/businesses/${businessId}/cash-drawer/open`, {
      openingFloat,
      staffId: staffId ?? null,
    }),
  closeDrawer: (businessId: number, sessionId: number, countedCash: number, notes?: string) =>
    apiClient.post<DrawerSession>(`/businesses/${businessId}/cash-drawer/${sessionId}/close`, {
      countedCash,
      notes: notes ?? null,
    }),
  moveCash: (
    businessId: number,
    sessionId: number,
    direction: 'IN' | 'OUT',
    amount: number,
    reason: string,
  ) =>
    apiClient.post<{ expected: number }>(
      `/businesses/${businessId}/cash-drawer/${sessionId}/movements`,
      { direction, amount, reason },
    ),

  // invoices
  getInvoices: (businessId: number, from?: string, to?: string) =>
    apiClient.get<InvoiceSummary[]>(`/businesses/${businessId}/invoices${range(from, to)}`),
  getInvoice: (businessId: number, invoiceId: number) =>
    apiClient.get<Invoice>(`/businesses/${businessId}/invoices/${invoiceId}`),
  issueInvoice: (
    businessId: number,
    saleId: number,
    buyer?: { buyerName?: string; buyerAddress?: string; buyerTaxNumber?: string; buyerEmail?: string },
  ) => apiClient.post<Invoice>(`/businesses/${businessId}/invoices`, { saleId, ...(buyer ?? {}) }),
  voidInvoice: (businessId: number, invoiceId: number, reason: string) =>
    apiClient.post<Invoice>(`/businesses/${businessId}/invoices/${invoiceId}/void`, { reason }),

  // kept deposits
  getForfeits: (businessId: number, from?: string, to?: string) =>
    apiClient.get<ForfeitReport>(`/businesses/${businessId}/deposit-forfeits${range(from, to)}`),
  getForfeitCandidates: (businessId: number) =>
    apiClient.get<ForfeitCandidate[]>(`/businesses/${businessId}/deposit-forfeits/eligible`),
  keepDeposit: (businessId: number, bookingId: number, reason: string) =>
    apiClient.post<{ amount: number }>(`/businesses/${businessId}/deposit-forfeits/${bookingId}`, { reason }),
  releaseDeposit: (businessId: number, bookingId: number) =>
    apiClient.delete<{ released: boolean }>(`/businesses/${businessId}/deposit-forfeits/${bookingId}`),
};

/**
 * Refunds. The endpoint has existed since deposits were built and nothing in this app
 * ever called it, so issuing one meant opening the Stripe dashboard — outside every
 * record this system keeps.
 */
export const refundService = {
  /** Omit the amount for a full refund of the booking price. */
  refund: (bookingId: number, amount?: number, reason?: string) =>
    apiClient.post<{
      bookingId: number;
      amount: number;
      stripeRefundId: string | null;
      reason: string | null;
      status: string;
    }>(`/payments/refund/${bookingId}`, { amount: amount ?? null, reason: reason ?? null }),
};
