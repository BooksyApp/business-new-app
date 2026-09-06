import { apiClient } from '@/config/api';

export interface BusinessRequest {
  depositPercent?: number;
  cancellationWindowHours?: number;
  lateCancellationFee?: number;
  ownerId: number;
  name: string;
  description?: string;
  category?: string;
  logoUrl?: string;
  /**
   * customer-app #4: the photo customers see for this salon. Until V74 there was no
   * image column at all, so every salon in the customer app showed the same stock shot.
   * A URL the salon supplies — there is no file storage yet. Empty string clears it.
   */
  coverImageUrl?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  buildingNumber?: string;
  apartmentNumber?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
}

export interface Business {
  /** #12: ISO code from businesses.currency (V17). Drives every price display. */
  currency?: string;
  /**
   * #37: the deposit and cancellation policy. Backed by businesses.deposit_percent /
   * cancellation_window_hours / late_cancellation_fee (V41), read and written by the
   * backend since #244/#308 — no screen had ever exposed them, so a feature that
   * shipped complete on the server was unreachable from the manager app.
   */
  depositPercent?: number;
  cancellationWindowHours?: number;
  lateCancellationFee?: number;
  id: number;
  ownerId: number;
  name: string;
  description?: string;
  category?: string;
  logoUrl?: string;
  /** customer-app #4: the photo customers see for this salon. */
  coverImageUrl?: string;
  website?: string;
  email?: string;
  phone?: string;
  address?: string;
  buildingNumber?: string;
  apartmentNumber?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  status: string;
  subscriptionPlan: string;
  createdAt: string;
  updatedAt?: string;
  verifiedAt?: string;
}

export interface BranchRequest {
  businessId: number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
}

export interface Branch {
  id: number;
  businessId: number;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  phone?: string;
  email?: string;
  createdAt: string;
  updatedAt?: string;
}

class BusinessService {
  async createBusiness(data: BusinessRequest, _accessToken?: string): Promise<Business> {
    return apiClient.post<Business>('/businesses', data);
  }

  async getBusiness(id: number, _accessToken?: string): Promise<Business> {
    return apiClient.get<Business>(`/businesses/${id}`);
  }

  async getBusinessesByOwner(ownerId: number, _accessToken?: string): Promise<Business[]> {
    return apiClient.get<Business[]>(`/businesses/owner/${ownerId}`);
  }

  async updateBusiness(id: number, data: Partial<BusinessRequest>, _accessToken?: string): Promise<Business> {
    return apiClient.put<Business>(`/businesses/${id}`, data);
  }

  async createBranch(data: BranchRequest, _accessToken?: string): Promise<Branch> {
    return apiClient.post<Branch>(`/businesses/${data.businessId}/branches`, data);
  }
}

export const businessService = new BusinessService();
