import { apiClient } from "@/config/api";

export interface BusinessHours {
  id: number;
  businessId: number;
  dayOfWeek: string;
  enabled: boolean;
  startTime: string | null;
  endTime: string | null;
}

export interface BusinessHoursUpdateItem {
  dayOfWeek: string;  // MONDAY, TUESDAY, etc.
  enabled: boolean;
  startTime: string;  // "09:00"
  endTime: string;    // "17:00"
}

export const businessHoursService = {
  async getBusinessHoursByBusinessId(businessId: number): Promise<BusinessHours[]> {
    return apiClient.get<BusinessHours[]>(`/business-hours/business/${businessId}`);
  },

  async updateBusinessHours(businessId: number, hours: BusinessHoursUpdateItem[]): Promise<BusinessHours[]> {
    return apiClient.put<BusinessHours[]>(`/business-hours/business/${businessId}`, hours);
  },
};
























/**
 * #257: holiday closures and one-off special hours. HoursExceptionController has had
 * list / create / delete since then with no caller, so a salon could not mark a holiday.
 * openTime/closeTime are required exactly when `closed` is false.
 */
export interface HoursException {
  id: number;
  businessId: number;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  closed: boolean;
  openTime: string | null; // HH:mm[:ss]
  closeTime: string | null;
  notes: string | null;
}

export const hoursExceptionService = {
  list: (businessId: number) => apiClient.get<HoursException[]>(`/business-hours-exceptions/business/${businessId}`),
  create: (input: Omit<HoursException, "id">) => apiClient.post<HoursException>(`/business-hours-exceptions`, input),
  remove: (businessId: number, id: number) =>
    apiClient.delete<void>(`/business-hours-exceptions/${id}?businessId=${businessId}`),
};
