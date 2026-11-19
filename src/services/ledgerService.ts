import { apiClient } from "@/config/api";
import type { Id } from "@/types/id";
import { t, type TKey } from "@/i18n";

export type LedgerStatus = "PAID" | "PARTIAL" | "OWED" | "REFUNDED" | "PART_REFUNDED" | "VOID";
export const LEDGER_STATUSES: LedgerStatus[] = ["PAID", "PARTIAL", "OWED", "REFUNDED", "PART_REFUNDED", "VOID"];
/** Tender methods as stored (sale_payments.method), plus DEBT for what is left on account. */
export const LEDGER_METHODS = ["CASH", "CARD_TERMINAL", "ONLINE", "GIFT_CARD", "WALLET", "PREPAID", "MEMBERSHIP", "PACKAGE", "POINTS", "DEBT"] as const;

export interface LedgerRow {
  /** The sale (public id); online purchases have `ref` instead. */
  id?: Id;
  ref?: string;
  kind: "SALE" | "GIFT_CARD_ONLINE" | "WALLET_TOPUP";
  date: string;
  time: string;
  clientId?: Id | null;
  clientName: string | null;
  staffId?: Id | null;
  staffName?: string | null;
  items: string | null;
  total: number;
  paid: number;
  tip: number;
  refunded: number;
  owed: number;
  methods: { method: string; amount: number }[];
  status: LedgerStatus;
  billNumber?: string | null;
  invoiceNumber?: string | null;
}

export interface Ledger {
  period: { start: string; end: string };
  totals: { takings: number; refunds: number; net: number; owed: number; tips: number; count: number; byMethod: Record<string, number> };
  days: { date: string; takings: number; refunds: number; net: number; count: number }[];
  rows: LedgerRow[];
  truncated: boolean;
}

export interface LedgerFilter {
  from: string;
  to: string;
  method?: string;
  staffId?: Id;
  status?: string;
  q?: string;
}

/** GET /sales/business/{id}/ledger (booksy-backend SalesLedgerService). */
export const ledgerService = {
  get(businessId: Id, f: LedgerFilter): Promise<Ledger> {
    const p = new URLSearchParams({ from: f.from, to: f.to });
    if (f.method) p.set("method", f.method);
    if (f.staffId) p.set("staffId", String(f.staffId));
    if (f.status) p.set("status", f.status);
    if (f.q) p.set("q", f.q);
    return apiClient.get<Ledger>(`/sales/business/${businessId}/ledger?${p.toString()}`);
  },
};

/** A tender method as the salon reads it (falls back to the stored code). */
export const methodLabel = (m: string) => {
  const k = `ledger.m.${m}` as TKey;
  const v = t(k);
  return v === k ? m : v;
};
