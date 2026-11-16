import type { Id } from "@/types/id";
import { apiClient } from '@/config/api';

export enum PaymentMethod {
  CASH = 'CASH',
  CHECK = 'CHECK',
  BANK_TRANSFER = 'BANK_TRANSFER',
  PAYPAL = 'PAYPAL',
  VENMO = 'VENMO',
  OTHER = 'OTHER'
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  PROCESSED = 'PROCESSED',
  FAILED = 'FAILED',
  CANCELLED = 'CANCELLED'
}

export interface Payment {
  id: Id;
  businessId: Id;
  staffId: Id;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  paymentDate: string;
  periodStart?: string;
  periodEnd?: string;
  referenceNumber?: string;
  notes?: string;
}

export interface CreatePaymentRequest {
  businessId: Id;
  staffId: Id;
  amount: number;
  method: PaymentMethod;
  paymentDate: string;
  periodStart?: string;
  periodEnd?: string;
  commissionIds?: Id[];
  referenceNumber?: string;
  notes?: string;
}

export const paymentService = {
  async createPayment(request: CreatePaymentRequest): Promise<Payment> {
    return apiClient.post<Payment>('/payments', request);
  },

  async getPaymentsByStaff(businessId: Id, staffId: Id): Promise<Payment[]> {
    return apiClient.get<Payment[]>(`/payments/business/${businessId}/staff/${staffId}`);
  },

  async getPaymentsByDateRange(
    businessId: Id,
    staffId: Id,
    startDate: string,
    endDate: string
  ): Promise<Payment[]> {
    return apiClient.get<Payment[]>(
      `/payments/business/${businessId}/staff/${staffId}/date-range?startDate=${startDate}&endDate=${endDate}`
    );
  },

  async getPaymentsByBusiness(businessId: Id): Promise<Payment[]> {
    return apiClient.get<Payment[]>(`/payments/business/${businessId}`);
  },

  async updatePaymentStatus(id: Id, status: PaymentStatus): Promise<Payment> {
    return apiClient.put<Payment>(`/payments/${id}/status?status=${status}`, {});
  },

  async cancelPayment(id: Id): Promise<void> {
    return apiClient.put(`/payments/${id}/cancel`, {});
  },
};


