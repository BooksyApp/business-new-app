import { apiClient } from '@/config/api';

/**
 * Putting a service on offer.
 *
 * A promo code is something a client has to already know. This is the other half: a price
 * you have cut, shown as a cut price on your card in the app and on the web — the thing
 * that actually makes somebody stop scrolling.
 */
export interface ServiceDiscount {
  id: number;
  name: string;
  price: number;
  duration: number;
  is_active: boolean;
  discount_percent: number | null;
  discount_starts_on: string | null;
  discount_ends_on: string | null;
  discount_label: string | null;
  /** Set and inside its dates — an offer can exist without running yet. */
  running: boolean;
  /** What a client pays while it runs. */
  sale_price: number | null;
}

export interface DiscountInput {
  /** Null clears the offer. */
  percent: number | null;
  startsOn?: string | null;
  endsOn?: string | null;
  label?: string | null;
}

export const discountService = {
  list: (businessId: number) =>
    apiClient.get<ServiceDiscount[]>(`/services/business/${businessId}/discounts`),

  setForService: (businessId: number, serviceId: number, input: DiscountInput) =>
    apiClient.put<void>(`/services/${serviceId}/discount`, { businessId, ...input }),

  /** The same offer across the whole menu, because setting twenty by hand never finishes. */
  setForAll: (businessId: number, input: DiscountInput) =>
    apiClient.put<{ services: number }>(`/services/business/${businessId}/discount`, input),
};
