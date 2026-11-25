import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

export interface QuickSaleItem {
  id: Id;
  businessId: Id;
  serviceId: Id;
  serviceName: string;
  serviceType: 'SERVICE' | 'COMBO';
  durationMinutes?: number;
  price?: number;
  priceType?: 'FIXED' | 'FROM' | 'RANGE';
  color?: string;
  displayOrder: number;
}

export const quickSaleService = {
  async getQuickSaleItems(businessId: Id): Promise<QuickSaleItem[]> {
    return apiClient.get<QuickSaleItem[]>(`/quick-sale/business/${businessId}`);
  },

  async updateQuickSaleItems(businessId: Id, serviceIds: Id[]): Promise<QuickSaleItem[]> {
    return apiClient.put<QuickSaleItem[]>(`/quick-sale/business/${businessId}`, serviceIds);
  },
};

