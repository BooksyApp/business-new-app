import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

/** A quiet-hour offer (QUIET: weekday ISO 1-7 and a window) or the last-minute offer (LAST_MINUTE). FG-W2-09. */
export interface SlotOffer {
  kind: "QUIET" | "LAST_MINUTE";
  weekday?: number | null;
  startTime?: string | null;
  endTime?: string | null;
  hoursAhead?: number | null;
  percent: number;
}

export const slotOfferService = {
  list: (businessId: Id) => apiClient.get<SlotOffer[]>(`/bookings/business/${businessId}/slot-discounts`),
  save: (businessId: Id, offers: SlotOffer[]) =>
    apiClient.put<SlotOffer[]>(`/bookings/business/${businessId}/slot-discounts`, offers),
};
