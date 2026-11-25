import type { Id } from "@/types/id";
import { apiClient } from '@/config/api';

export enum CommissionCategory {
  DEFAULT = 'DEFAULT',
  SERVICES = 'SERVICES',
  PRODUCTS = 'PRODUCTS',
  GIFT_CARDS = 'GIFT_CARDS',
  MEMBERSHIPS = 'MEMBERSHIPS',
  PACKAGES = 'PACKAGES'
}

export enum CommissionType {
  PERCENTAGE = 'PERCENTAGE',
  FIXED_AMOUNT = 'FIXED_AMOUNT'
}

export enum CommissionStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  CANCELLED = 'CANCELLED'
}

export interface CommissionRule {
  id?: Id;
  businessId: Id;
  category: CommissionCategory;
  staffId?: Id;
  serviceId?: Id;
  categoryId?: Id;
  type: CommissionType;
  value: number;
  description?: string;
  isActive?: boolean;
}

export interface Commission {
  id: Id;
  businessId: Id;
  staffId: Id;
  appointmentId?: string;
  serviceId?: Id;
  saleId?: Id;
  category: CommissionCategory;
  saleAmount: number;
  commissionAmount: number;
  status: CommissionStatus;
  commissionDate: string;
  paymentId?: Id;
  notes?: string;
}

export interface CreateCommissionRuleRequest {
  businessId: Id;
  category: CommissionCategory;
  staffId?: Id;
  serviceId?: Id;
  categoryId?: Id;
  type: CommissionType;
  value: number;
  description?: string;
  isActive?: boolean;
}

export const commissionService = {
  // Commission Rules
  async getCommissionRules(businessId: Id): Promise<CommissionRule[]> {
    return apiClient.get<CommissionRule[]>(`/commission-rules/business/${businessId}`);
  },

  async getCommissionRulesByCategory(businessId: Id, category: CommissionCategory): Promise<CommissionRule[]> {
    return apiClient.get<CommissionRule[]>(`/commission-rules/business/${businessId}/category/${category}`);
  },

  async getCommissionRulesByStaff(businessId: Id, staffId: Id): Promise<CommissionRule[]> {
    return apiClient.get<CommissionRule[]>(`/commission-rules/business/${businessId}/staff/${staffId}`);
  },

  async createCommissionRule(request: CreateCommissionRuleRequest): Promise<CommissionRule> {
    return apiClient.post<CommissionRule>('/commission-rules', request);
  },

  async updateCommissionRule(id: Id, request: Partial<CommissionRule>): Promise<CommissionRule> {
    return apiClient.put<CommissionRule>(`/commission-rules/${id}`, request);
  },

  async deleteCommissionRule(id: Id): Promise<void> {
    return apiClient.delete(`/commission-rules/${id}`);
  },

  async deactivateCommissionRule(id: Id): Promise<void> {
    return apiClient.put(`/commission-rules/${id}/deactivate`, {});
  },

  async deleteAllCommissionRules(businessId: Id): Promise<void> {
    return apiClient.delete(`/commission-rules/business/${businessId}/all`);
  },

  // Commissions
  async getCommissionsByStaff(businessId: Id, staffId: Id): Promise<Commission[]> {
    return apiClient.get<Commission[]>(`/commissions/business/${businessId}/staff/${staffId}`);
  },

  async getPendingCommissions(businessId: Id, staffId: Id): Promise<Commission[]> {
    return apiClient.get<Commission[]>(`/commissions/business/${businessId}/staff/${staffId}/pending`);
  },

  // #17: the backend returns { totalPending: <number> }, not a bare number — this used
  // to fetch it typed as `number` (an unchecked cast, no runtime mismatch), so the
  // whole response OBJECT ended up in useCommissions()'s totalPending state. Staff
  // page's "Total: {totalPending.toFixed(2)} zł" then called .toFixed on an object,
  // throwing during render — the actual cause of "selecting a staffer under
  // COMMISSIONS crashes the whole page" (a same-tick, unrelated 500 from a different
  // endpoint was the red herring that made this look network-related).
  async getTotalPendingCommission(businessId: Id, staffId: Id): Promise<number> {
    const result = await apiClient.get<{ totalPending: number }>(
      `/commissions/business/${businessId}/staff/${staffId}/total-pending`
    );
    return result?.totalPending ?? 0;
  },

  async getCommissionsByDateRange(
    businessId: Id,
    staffId: Id,
    startDate: string,
    endDate: string
  ): Promise<Commission[]> {
    return apiClient.get<Commission[]>(
      `/commissions/business/${businessId}/staff/${staffId}/date-range?startDate=${startDate}&endDate=${endDate}`
    );
  },

  async calculateCommission(
    businessId: Id,
    staffId: Id,
    appointmentId: string,
    serviceId: Id,
    saleAmount: number
  ): Promise<Commission> {
    return apiClient.post<Commission>(
      `/commissions/calculate?businessId=${businessId}&staffId=${staffId}&appointmentId=${appointmentId}&serviceId=${serviceId}&saleAmount=${saleAmount}`,
      {}
    );
  },

  async cancelCommission(id: Id): Promise<void> {
    return apiClient.put(`/commissions/${id}/cancel`, {});
  },

  async cancelCommissionsForAppointment(appointmentId: string): Promise<void> {
    return apiClient.put(`/commissions/appointment/${appointmentId}/cancel`, {});
  },
};

