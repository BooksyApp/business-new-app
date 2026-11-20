import type { Id } from "@/types/id";
import { apiClient } from '@/config/api';
import { format } from '@/i18n/dateFns';

export interface SaleItem {
  id?: Id;
  serviceId?: Id;
  serviceName: string;
  serviceType: string;
  quantity: number;
  unitPrice: number;
  totalPrice?: number;
  duration?: string;
  notes?: string;
}

export interface Sale {
  id: Id;
  businessId: Id;
  staffId?: Id;
  staffName?: string;
  clientId?: Id;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  saleDate: string;
  saleTime: string;
  items: SaleItem[];
  subtotal: number;
  discountAmount: number;
  discountPercent: number;
  tipAmount: number;
  tipPercent: number;
  total: number;
  paymentMethod: 'CASH' | 'CARD_TERMINAL' | 'CHECK' | 'SPLIT' | 'MEMBERSHIP' | 'GIFT_CARD' | 'PACKAGE';
  paymentAmount: number;
  changeAmount: number;
  /** Required when paymentMethod is GIFT_CARD — the card is spent by code. */
  giftCardCode?: string;
  splitCashAmount?: number;
  splitCardAmount?: number;
  status: 'PENDING' | 'COMPLETED' | 'CANCELLED' | 'REFUNDED';
  notes?: string;
  billNumber?: string;
  billId?: string;
  /** Detail only: sum of partial/full refunds, NONE | PARTIALLY_REFUNDED | REFUNDED, and each refund. */
  refundedAmount?: number;
  refundStatus?: 'NONE' | 'PARTIALLY_REFUNDED' | 'REFUNDED';
  /** Detail only: the tenders the bill was settled with (CASH, POINTS, GIFT_CARD...). */
  payments?: Array<{ method: string; amount: number; reference?: string }>;
  refunds?: Array<{ amount: number; method?: string; reason?: string; created_at?: string }>;
}

export interface CreateSaleRequest {
  businessId: Id;
  staffId?: Id;
  clientId?: Id;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  items: Array<{
    serviceId?: Id;
    serviceName: string;
    serviceType: string;
    quantity: number;
    unitPrice: number;
    duration?: string;
    notes?: string;
  }>;
  discountAmount?: number;
  discountPercent?: number;
  tipAmount?: number;
  tipPercent?: number;
  paymentMethod: 'CASH' | 'CARD_TERMINAL' | 'CHECK' | 'SPLIT' | 'MEMBERSHIP' | 'GIFT_CARD' | 'PACKAGE';
  paymentAmount: number;
  notes?: string;
  /**
   * The tenders this bill was settled with. The two split fields could only describe one
   * shape of split — half cash, half card — so "60 on a gift card, 40 in notes" had to be
   * rung up as two sales. Absent keeps the old single-method behaviour.
   */
  payments?: Array<{ method: string; amount: number; reference?: string }>;
  /**
   * Who the tip belongs to. Absent gives the whole tip to whoever did the work, which is
   * what a one-chair salon means when it types a tip in.
   */
  tips?: Array<{ staffId?: Id; amount: number; method?: string }>;
  splitCashAmount?: number;
  splitCardAmount?: number;
}

export interface SaleRefundSummary {
  status: string;
  total: number;
  refunded: number;
  refundable: number;
  onlinePayment: boolean;
  refunds: Array<{ amount: number; method: string; reason: string }>;
}

export interface SaleRefundRequest {
  lines?: Array<{ saleItemId: Id; quantity: number }>;
  amount?: number;
  method: 'CASH' | 'CARD_TERMINAL' | 'CHECK' | 'GIFT_CARD';
  reason: string;
  giftCardCode?: string;
}

export interface SaleRefundResult {
  amount: number;
  method: string;
  saleStatus: string;
  refunded: number;
  refundable: number;
}

export const saleService = {
  async getSalesByBusiness(businessId: Id, date?: Date): Promise<Sale[]> {
    if (date) {
      const dateStr = format(date, 'yyyy-MM-dd');
      return apiClient.get<Sale[]>(`/sales/business/${businessId}?date=${dateStr}`);
    }
    return apiClient.get<Sale[]>(`/sales/business/${businessId}`);
  },

  async getSalesByDateRange(businessId: Id, startDate: Date, endDate: Date): Promise<Sale[]> {
    const startDateStr = format(startDate, 'yyyy-MM-dd');
    const endDateStr = format(endDate, 'yyyy-MM-dd');
    return apiClient.get<Sale[]>(`/sales/business/${businessId}?startDate=${startDateStr}&endDate=${endDateStr}`);
  },

  async getSaleById(id: Id): Promise<Sale> {
    return apiClient.get<Sale>(`/sales/${id}`);
  },

  async createSale(request: CreateSaleRequest): Promise<Sale> {
    return apiClient.post<Sale>('/sales', request);
  },

  async cancelSale(id: Id): Promise<void> {
    return apiClient.delete<void>(`/sales/${id}`);
  },

  /** FG-W6-08: what is left to refund on a sale, and its refunds so far. */
  async getRefundSummary(id: Id): Promise<SaleRefundSummary> {
    return apiClient.get<SaleRefundSummary>(`/sales/${id}/refunds`);
  },

  /** FG-W6-08: refund by lines (sale item id + quantity) or by amount. Owner or manager only. */
  async refundSale(id: Id, body: SaleRefundRequest): Promise<SaleRefundResult> {
    return apiClient.post<SaleRefundResult>(`/sales/${id}/refunds`, body);
  },
};











