import type { Id } from "@/types/id";
import { apiClient } from '@/config/api';

export interface Staff {
  id: Id;
  businessId: Id;
  name: string;
  email?: string;
  phone?: string;
  position?: string;
  avatarUrl?: string;
  initials?: string;
  // #13 (salon-hub): `role`, `workingHoursStart`/`workingHoursEnd` are the only staff
  // fields the backend (`StaffDto`) actually sends. `workingHours` (singular string),
  // `workingHoursDetail`, and the four `can*` booleans below used to be declared here
  // too, but nothing on the backend has ever populated them — every read of them was
  // silently `undefined`. Kept `workingHours`/`workingHoursDetail` for now since
  // CalendarPage.tsx still reads them (tracked separately, out of #13's scope); the
  // `can*` fields had no real callers left once #13's fixes landed, so they're gone.
  role?: string; // "OWNER" | "MANAGER" | "STAFF" — see staffService.setRole()
  workingHours?: string;
  workingHoursDetail?: Record<string, { start: string | null; end: string | null; isClosed: boolean }>;
  // Per-day working hours from the backend (keys "MONDAY"…, values "HH:mm[:ss]").
  workingHoursStart?: Record<string, string>;
  workingHoursEnd?: Record<string, string>;
  serviceIds?: Id[];
  isActive: boolean;
}

export interface CreateStaffRequest {
  name: string;
  email?: string;
  phone?: string;
  position?: string;
  serviceIds?: Id[];
  inviteAndCreateAccount?: boolean;
  /** "/api/public/uploads/<id>.jpg" from uploadImage(…, "STAFF_AVATAR"). */
  avatarUrl?: string;
  // staff-service schedule: { MONDAY: ["09:00","17:00"], … } — enabled days only.
  schedule?: Record<string, string[]>;
}

export interface UpdateStaffRequest {
  name?: string;
  email?: string;
  phone?: string;
  position?: string;
  serviceIds?: Id[];
  isActive?: boolean;
  /** "" removes the photo. */
  avatarUrl?: string;
  // staff-service schedule: { MONDAY: ["09:00","17:00"], … }. Update replaces all days.
  schedule?: Record<string, string[]>;
}

export const staffService = {
  async getStaffByBusiness(businessId: Id): Promise<Staff[]> {
    return apiClient.get<Staff[]>(`/staff/business/${businessId}`);
  },

  async getStaffById(id: Id, businessId: Id): Promise<Staff> {
    return apiClient.get<Staff>(`/staff/${id}/business/${businessId}`);
  },

  async createStaff(businessId: Id, request: CreateStaffRequest): Promise<Staff> {
    return apiClient.post<Staff>(`/staff/business/${businessId}`, request);
  },

  async updateStaff(id: Id, businessId: Id, request: UpdateStaffRequest): Promise<Staff> {
    return apiClient.put<Staff>(`/staff/${id}/business/${businessId}`, request);
  },

  async deleteStaff(id: Id, businessId: Id): Promise<void> {
    return apiClient.delete<void>(`/staff/${id}/business/${businessId}`);
  },

  // #13/#293: the "Permission Level" picker in Add/Edit Staff was decorative — the
  // value never reached the backend (there's no such field on the create/update DTO).
  // Role has its own dedicated endpoint instead.
  /** Email (or re-email) the link that lets this team member set up their own sign-in. */
  async sendInvite(id: Id): Promise<{ email: string; sent: boolean; expiresAt: string }> {
    return apiClient.post(`/staff/${id}/invite`, {});
  },

  async setRole(id: Id, role: string): Promise<Staff> {
    return apiClient.put<Staff>(`/staff/${id}/role`, { role });
  },

  /** Active staff of the salon in "any master" priority order. */
  async getAssignmentOrder(businessId: Id): Promise<{ id: Id; name: string; priority: number }[]> {
    return apiClient.get(`/staff-assignment/business/${businessId}`);
  },

  /** Saves the priority order (first = tried first). 204. */
  async setAssignmentOrder(businessId: Id, staffIds: Id[]): Promise<void> {
    await apiClient.put(`/staff-assignment/business/${businessId}`, { staffIds });
  },
};










