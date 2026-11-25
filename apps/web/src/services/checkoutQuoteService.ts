import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";
import type { SalePayment } from "@/services/paymentConfirmationService";

/** A benefit applied to one line: a membership or package session (the line becomes 0). */
export interface QuoteLineBenefit {
  id: string;
  kind: "PACKAGE" | "MEMBERSHIP";
  name: string;
  sessionsLeft: number;
  sessionsTotal: number;
  amount: number;
  removable: boolean;
}

export interface QuoteLine {
  lineId: string;
  name: string;
  staffName?: string | null;
  quantity: number;
  unitPrice: number;
  amount: number;
  benefits: QuoteLineBenefit[];
}

/** Off the bill and not removable: the booking's promo, a manual discount, a deposit, points spent at booking. */
export interface QuoteCredit {
  id: string;
  kind: "PROMO" | "DISCOUNT" | "DEPOSIT" | "BOOKED_POINTS";
  amount: number;
  code?: string;
}

/** Paid from something the client already has. Removable except an online prepayment. */
export interface QuoteTender {
  id: string;
  kind: "PREPAID" | "GIFT_CARD" | "WALLET" | "POINTS";
  amount: number;
  removable: boolean;
  giftCardCode?: string;
  points?: number;
}

export interface CheckoutQuote {
  lines: QuoteLine[];
  subtotal: number;
  discount: number;
  tip: number;
  promoCode?: string | null;
  credits: QuoteCredit[];
  tenders: QuoteTender[];
  pointsSuggestion: { points: number; amount: number; applied: boolean } | null;
  debt: { amount: number; included: boolean } | null;
  /** What the sale asks for before any tender; sent back with the sale as quoteBillDue. */
  billDue: number;
  /** To take now by cash or card, old debt included when asked. */
  due: number;
  /** The sale's own part of `due` (without old debt). */
  saleDue: number;
  coverage: Record<string, "PACKAGE" | "MEMBERSHIP">;
  /** Tenders ready for /payment-confirmation (prepaid, gift card, wallet, points). */
  payments: SalePayment[];
}

export interface CheckoutQuoteRequest {
  clientId?: Id | null;
  appointmentIds?: string[];
  items: Array<{ lineId: string; serviceId?: Id; productId?: Id; name: string; quantity: number; unitPrice: number; staffName?: string }>;
  giftCardCode?: string;
  removed?: string[];
  usePoints?: boolean;
  includeDebt?: boolean;
  discountAmount?: number;
  tipAmount?: number;
}

/**
 * POS v3: the bill priced by the server with every benefit the salon already knows applied
 * (packages, memberships, promo, deposit, prepayment, wallet). Read-only; the sale re-checks.
 */
export const checkoutQuoteService = {
  quote: (businessId: Id, body: CheckoutQuoteRequest) =>
    apiClient.post<CheckoutQuote>(`/businesses/${businessId}/checkout/quote`, body),
};
