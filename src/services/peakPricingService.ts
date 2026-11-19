import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

/** FG-W4-06: a peak-hour surcharge window for one service. weekday is ISO (1 = Monday ... 7 = Sunday). */
export interface PeakRule {
  weekday: number;
  startTime: string;
  endTime: string;
  percent: number;
}

export const peakPricingService = {
  list: (businessId: Id, serviceId: Id) =>
    apiClient.get<PeakRule[]>(`/bookings/business/${businessId}/services/${serviceId}/peak-pricing`),
  save: (businessId: Id, serviceId: Id, rules: PeakRule[]) =>
    apiClient.put<PeakRule[]>(`/bookings/business/${businessId}/services/${serviceId}/peak-pricing`, rules),
};
