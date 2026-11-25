import type { Id } from "@/types/id";
import { apiClient } from '@/config/api';

/** One month of the revenue report: what the salon planned, and what the month brought in. */
export interface RevenuePlanMonth {
  month: string; // yyyy-MM
  plan: number;
  actual: number;
}

export const revenuePlanService = {
  list(businessId: Id, year: number): Promise<RevenuePlanMonth[]> {
    return apiClient.get<RevenuePlanMonth[]>(`/businesses/${businessId}/revenue-plan?year=${year}`);
  },

  set(businessId: Id, month: string, amount: number): Promise<void> {
    return apiClient.put<void>(`/businesses/${businessId}/revenue-plan/${month}`, { amount });
  },
};
