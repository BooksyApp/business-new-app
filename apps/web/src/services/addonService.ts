import type { Id } from "@/types/id";
import { apiClient } from '@/config/api';

export interface Addon {
  id: Id;
  businessId: Id;
  name: string;
  description?: string;
  price?: number;
  priceType?: 'FIXED' | 'FROM' | 'RANGE';
  color?: string;
  isActive: boolean;
  isVisible: boolean;
}

export interface CreateAddonRequest {
  name: string;
  description?: string;
  price?: number;
  priceType?: 'FIXED' | 'FROM' | 'RANGE';
  color?: string;
}

export interface UpdateAddonRequest {
  name?: string;
  description?: string;
  price?: number;
  priceType?: 'FIXED' | 'FROM' | 'RANGE';
  color?: string;
  isActive?: boolean;
  isVisible?: boolean;
}

export const addonService = {
  async getAddonsByBusiness(businessId: Id): Promise<Addon[]> {
    return apiClient.get<Addon[]>(`/addons/business/${businessId}`);
  },

  async createAddon(businessId: Id, request: CreateAddonRequest): Promise<Addon> {
    return apiClient.post<Addon>(`/addons/business/${businessId}`, request);
  },

  async updateAddon(id: Id, businessId: Id, request: UpdateAddonRequest): Promise<Addon> {
    return apiClient.put<Addon>(`/addons/${id}/business/${businessId}`, request);
  },

  async deleteAddon(id: Id, businessId: Id): Promise<void> {
    return apiClient.delete<void>(`/addons/${id}/business/${businessId}`);
  },
};
























