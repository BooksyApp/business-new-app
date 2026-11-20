import type { Id } from "@/types/id";
import { apiClient } from '@/config/api';

/** One tender on a bill. A bill can have several: 20 off a gift card, 80 in cash. */
export interface SalePayment {
  // PREPAID: taken from a gift card when the booking was made (V114); never charged again.
  method: 'CASH' | 'CARD_TERMINAL' | 'CHECK' | 'GIFT_CARD' | 'POINTS' | 'PREPAID' | 'WALLET' | 'BOOQI_WALLET';
  amount: number;
  /** Gift card code, when the method is GIFT_CARD. */
  giftCardCode?: string;
  /** Points spent, when the method is POINTS. */
  points?: number;
  /** The customer's one-time code, when the method is BOOQI_WALLET. */
  reference?: string;
}

export interface PaymentConfirmationRequest {
  /** A gift card paying the whole bill (single-tender form); the server reads it. */
  giftCardCode?: string;
  /** Promo code the booking was made with; the server applies it and counts the use. */
  promoCode?: string;
  /** FG-W6-07: tenders may fall short of the amount due; the rest becomes the client's balance. Needs clientId. */
  leaveBalance?: boolean;
  /** POS v3: the checkout quote's bill; the sale refuses one that changed since (409). */
  quoteBillDue?: number;
  /** Several tenders on one bill. Preferred over paymentMethod + split fields. */
  payments?: SalePayment[];
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
    /** A benefit that pays for this line instead of money. */
    coveredBy?: 'MEMBERSHIP' | 'PACKAGE' | 'VISIT_REWARD';
    /** Set when the line IS a membership being sold, so the sale enrols the client. */
    membershipId?: Id;
    /** Set when the line is a gift card being sold, so the sale issues one. */
    giftCardAmount?: number;
    /** The booking this line is the service of. */
    appointmentId?: string;
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
  appointmentId?: string;
  /** One visit, one ticket: every booking this sale settles. Unioned with appointmentId. */
  appointmentIds?: string[];
}

export interface PaymentConfirmationResponse {
  saleId: Id;
  businessId: Id;
  totalAmount: number;
  commissions: Array<{
    commissionId: Id;
    staffId: Id;
    serviceId: Id;
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

