import { apiClient } from "@/config/api";
import type { Id } from "@/types/id";

type Num = number | string;

export interface ProfitMonth {
  month: string;
  takings: Num;
  refunds: Num;
  revenue: Num;
  wages: Num;
  expenses: Num;
  commission: Num;
  profit: Num;
}

export interface ProfitByMonth {
  months: ProfitMonth[];
  totals: { revenue: Num; refunds: Num; expenses: Num; wages: Num; commission: Num; profit: Num };
  byCategory: { category: string; amount: Num; entries: Num }[];
  /** False until salon billing (commission statements) is live. */
  commissionTracked: boolean;
}

export interface TaxRow {
  count: Num;
  net: Num;
  tax: Num;
  gross: Num;
}

export interface TaxSummary {
  period: { start: string; end: string };
  totals: TaxRow;
  byRate: (TaxRow & { rate: Num })[];
  byMonth: (TaxRow & { month: string })[];
  voided: Num;
}

/** HUB-V3 money pages: profit by month (ExpenseService.monthly) and tax on issued invoices. */
export const accountsService = {
  profitByMonth: (businessId: Id, months: number) =>
    apiClient.get<ProfitByMonth>(`/businesses/${businessId}/profit-and-loss/monthly?months=${months}`),
  taxSummary: (businessId: Id, from: string, to: string) =>
    apiClient.get<TaxSummary>(`/businesses/${businessId}/tax-summary?from=${from}&to=${to}`),
};

export const n = (v: Num | null | undefined) => {
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
};
