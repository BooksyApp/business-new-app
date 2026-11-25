import type { Id } from "@/types/id";
import { apiClient } from '@/config/api';

/**
 * One team member for one month: the target the owner or manager set, and what the member
 * actually booked (not cancelled) and was charged for in that month.
 */
export interface StaffTargetRow {
  staffId: Id;
  staffName: string;
  revenueTarget: number;
  bookingsTarget: number;
  revenueActual: number;
  bookingsActual: number;
}

export const staffTargetService = {
  list(businessId: Id, month: string): Promise<StaffTargetRow[]> {
    return apiClient.get<StaffTargetRow[]>(`/businesses/${businessId}/staff-targets?month=${encodeURIComponent(month)}`);
  },

  set(businessId: Id, staffId: Id, month: string, body: { revenueTarget: number; bookingsTarget: number }): Promise<void> {
    return apiClient.put<void>(`/businesses/${businessId}/staff-targets/${staffId}?month=${encodeURIComponent(month)}`, body);
  },
};
