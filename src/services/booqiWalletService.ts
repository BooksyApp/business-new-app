import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

/**
 * The salon's side of the booqi balance: what booqi still owes it for customer payments made
 * with booqi balance. Read-only; the endpoint answers 404 while the platform has the wallet off.
 */
export interface BooqiPayoutItem {
  id: number;
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
  items: BooqiPayoutItem[];
  batches: Array<{ id: number; total: number; item_count: number; reference?: string | null; paid_at: string }>;
}

export const booqiWalletService = {
  payouts: (businessId: Id) => apiClient.get<BooqiPayouts>(`/businesses/${businessId}/wallet/payouts`),
};
