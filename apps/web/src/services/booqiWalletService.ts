import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

/**
 * The salon's side of the booqi balance: what booqi still owes it for customer payments made
 * with booqi balance. Read-only; the endpoint answers 404 while the platform has the wallet off.
 */
export interface BooqiPayoutItem {
  id: number;
  source: "ONLINE" | "WALLET";
  kind: "PAYMENT" | "REFUND";
  gross_amount: number;
  commission_percent: number;
  commission_amount: number;
  net_amount: number;
  status: "PENDING" | "PAID";
  created_at: string;
  paid_at?: string | null;
}

export interface BooqiPayouts {
  currency: string;
  pending: number;
  paidTotal: number;
  commissionPercent: number;
  bySource: Array<{ source: "ONLINE" | "WALLET"; gross: number; commission: number; net: number; paid: number; pending: number }>;
  items: BooqiPayoutItem[];
  batches: Array<{ id: number; total: number; item_count: number; reference?: string | null; paid_at: string }>;
}

/** Takings by where the money was collected; refunds netted. Shown beside, not added to, the revenue charts. */
export interface RevenueSplit {
  currency: string;
  atSalon: number;
  online: number;
  wallet: number;
  onlineCommission: number;
  walletCommission: number;
}

export const booqiWalletService = {
  revenueSplit: (businessId: Id, from: string, to: string) =>
    apiClient.get<RevenueSplit>(`/businesses/${businessId}/wallet/revenue-split?from=${from}&to=${to}`),
  payouts: (businessId: Id) => apiClient.get<BooqiPayouts>(`/businesses/${businessId}/wallet/payouts`),
};
