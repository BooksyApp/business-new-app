import { apiClient } from '@/config/api';

/** One tender on a bill. A bill can have several: 20 off a gift card, 80 in cash. */
export interface SalePayment {
  method: 'CASH' | 'CARD_TERMINAL' | 'CHECK' | 'GIFT_CARD' | 'POINTS';
  amount: number;
  /** Gift card code, when the method is GIFT_CARD. */
  giftCardCode?: string;
  /** Points spent, when the method is POINTS. */
  points?: number;
}

export interface PaymentConfirmationRequest {
  /** Several tenders on one bill. Preferred over paymentMethod + split fields. */
  payments?: SalePayment[];
  businessId: number;
  staffId?: number;
  clientId?: number;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  items: Array<{
    serviceId?: number;
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
  paymentMethod: string;
  paymentAmount: number;
  splitCashAmount?: number;
  splitCardAmount?: number;
  notes?: string;
  appointmentId?: number;
}

export interface PaymentConfirmationResponse {
  saleId: number;
  businessId: number;
  totalAmount: number;
  commissions: Array<{
    commissionId: number;
    staffId: number;
    serviceId: number;
    saleAmount: number;
    commissionAmount: number;
  }>;
  appointmentUpdated: boolean;
  message: string;
}

export const paymentConfirmationService = {
  async confirmPayment(request: PaymentConfirmationRequest): Promise<PaymentConfirmationResponse> {
    return apiClient.post<PaymentConfirmationResponse>('/payment-confirmation', request);
  },
};

