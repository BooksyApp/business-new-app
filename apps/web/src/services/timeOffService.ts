import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

export interface TimeOff {
  id: Id;
  businessId: Id;
  staffId: Id;
  staffName: string;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  isFullDay: boolean;
  isRecurring: boolean;
  recurrencePattern?: string;
  recurrenceEndDate?: string;
  reason?: string;
  isApproved: boolean;
  needsManagerApproval: boolean;
  approvedBy?: Id;
  approvedAt?: string;
}

export interface CreateTimeOffRequest {
  businessId: Id;
  staffId: Id;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  isFullDay: boolean;
  isRecurring: boolean;
  recurrencePattern?: string;
  recurrenceEndDate?: string;
  reason?: string;
  isApproved: boolean;
}

export interface UpdateTimeOffRequest {
  startDate?: string;
  endDate?: string;
  startTime?: string;
  endTime?: string;
  isFullDay?: boolean;
  isRecurring?: boolean;
  recurrencePattern?: string;
  recurrenceEndDate?: string;
  reason?: string;
  isApproved?: boolean;
}

export const timeOffService = {
  async getTimeOffsByBusiness(businessId: Id): Promise<TimeOff[]> {
    return apiClient.get<TimeOff[]>(`/time-off/business/${businessId}`);
  },

  async getTimeOffsByStaff(staffId: Id): Promise<TimeOff[]> {
    return apiClient.get<TimeOff[]>(`/time-off/staff/${staffId}`);
  },

  async getTimeOffsForDate(businessId: Id, date: string): Promise<TimeOff[]> {
    return apiClient.get<TimeOff[]>(`/time-off/business/${businessId}/date/${date}`);
  },

  async getTimeOffsForStaffAndDate(businessId: Id, staffId: Id, date: string): Promise<TimeOff[]> {
    return apiClient.get<TimeOff[]>(`/time-off/business/${businessId}/staff/${staffId}/date/${date}`);
  },

  async createTimeOff(data: CreateTimeOffRequest): Promise<TimeOff> {
    return apiClient.post<TimeOff>("/time-off", data);
  },

  async updateTimeOff(id: Id, data: UpdateTimeOffRequest): Promise<TimeOff> {
    return apiClient.put<TimeOff>(`/time-off/${id}`, data);
  },

  async deleteTimeOff(id: Id): Promise<void> {
    return apiClient.delete(`/time-off/${id}`);
  },

  async approveTimeOff(id: Id, approvedBy: Id): Promise<TimeOff> {
    return apiClient.post<TimeOff>(`/time-off/${id}/approve?approvedBy=${approvedBy}`);
  },
};

