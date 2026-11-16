import type { Id } from "@/types/id";
import { apiClient } from '@/config/api';

export interface Shift {
  id: Id;
  businessId: Id;
  staffId: Id;
  staffName?: string;
  shiftDate: string; // ISO date string (YYYY-MM-DD)
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  notes?: string;
}

export interface CreateShiftRequest {
  staffId: Id;
  shiftDate: string; // ISO date string (YYYY-MM-DD)
  startTime: string; // HH:mm format
  endTime: string; // HH:mm format
  notes?: string;
}

export interface UpdateShiftRequest {
  shiftDate?: string;
  startTime?: string;
  endTime?: string;
  notes?: string;
}

export const shiftService = {
  async getShiftsByBusinessAndDate(businessId: Id, date: string): Promise<Shift[]> {
    return apiClient.get<Shift[]>(`/shifts/business/${businessId}/date/${date}`);
  },

  async getShiftsByStaffAndDate(staffId: Id, date: string): Promise<Shift[]> {
    return apiClient.get<Shift[]>(`/shifts/staff/${staffId}/date/${date}`);
  },

  async createShift(businessId: Id, request: CreateShiftRequest): Promise<Shift> {
    return apiClient.post<Shift>(`/shifts/business/${businessId}`, request);
  },

  async updateShift(id: Id, businessId: Id, request: UpdateShiftRequest): Promise<Shift> {
    return apiClient.put<Shift>(`/shifts/${id}/business/${businessId}`, request);
  },

  async deleteShift(id: Id, businessId: Id): Promise<void> {
    return apiClient.delete<void>(`/shifts/${id}/business/${businessId}`);
  },
};


