import type { Id } from "@/types/id";
import { apiClient } from '@/config/api';

/**
 * FG-W6-07: what a client owes the salon. A visit paid in part leaves a DEBT entry; a later
 * payment of that money is a SETTLEMENT. `outstanding` is the running total still owed.
 */

export type BalanceMethod = 'CASH' | 'CARD_TERMINAL' | 'CHECK' | 'GIFT_CARD';

export interface BalanceEntry {
  kind: 'DEBT' | 'SETTLEMENT' | 'TOPUP' | 'TOPUP_REFUND' | 'SPEND' | 'SPEND_RETURN';
  amount: number;
  sale_id: Id | null;
  method: string | null;
  note: string | null;
  created_at: string;
}

export interface ClientBalance {
  /** What the client owes, never negative. */
  outstanding: number;
  /** FG-W6-06: wallet credit the client can spend, never negative. */
  credit: number;
  /** Credit minus debt: positive is credit, negative is debt. */
  balance: number;
  /** Newest first, at most 50. */
  entries: BalanceEntry[];
}

export interface SettleRequest {
  amount: number;
  method: BalanceMethod;
  note?: string;
}

export const clientBalanceService = {
  get: (clientId: Id) => apiClient.get<ClientBalance>(`/clients/${clientId}/balance`),
  settle: (clientId: Id, body: SettleRequest) =>
    apiClient.post<ClientBalance>(`/clients/${clientId}/balance/settle`, body),
};
