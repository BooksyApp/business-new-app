import type { Id } from "@/types/id";
import { apiClient } from '@/config/api';

/**
 * FG-W6-05/06/09: what the salon sells online through Stripe: gift cards, wallet top-ups and the
 * "order and pick up" shop. Prices and totals are the server's; the hub only switches things on and
 * moves orders along.
 */
export interface OnlineSalesSettings {
  giftCardsEnabled: boolean;
  giftCardMin: number;
  giftCardMax: number;
  giftCardPresets: number[];
  walletEnabled: boolean;
  walletMin: number;
  walletMax: number;
  /** False while the platform has no Stripe keys: nothing is offered to customers. */
  stripeEnabled: boolean;
  currency: string;
  onlineSales: number;
}

export type OnlineSalesUpdate = Partial<Omit<OnlineSalesSettings, 'stripeEnabled' | 'currency' | 'onlineSales'>>;

export interface GiftCardRow {
  id: string;
  source: 'COUNTER' | 'ONLINE';
  codeTail: string;
  initial_amount: number;
  balance: number;
  status: string;
  currency: string;
  created_at: string;
  buyer_email: string | null;
  buyer_name: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  issued_to_email: string | null;
}

export interface ShopProduct {
  id: string;
  name: string;
  price: number;
  quantityOnHand: number;
  reserved: number;
  sellOnline: boolean;
}

export type ShopOrderStatus = 'PAID' | 'READY' | 'PICKED_UP' | 'CANCELLED' | 'EXPIRED';

export interface ShopOrder {
  id: string;
  ref: string;
  status: ShopOrderStatus;
  buyer_email: string;
  buyer_name: string | null;
  total: number;
  wallet_amount: number;
  card_amount: number;
  currency: string;
  created_at: string;
  items: Array<{ name: string; unit_price: number; quantity: number }>;
}

export interface WalletTopUp {
  id: string;
  amount: number;
  refunded_amount: number;
  currency: string;
  paid_at: string;
  refundable: number;
}

export const onlineSalesService = {
  get: (businessId: Id) => apiClient.get<OnlineSalesSettings>(`/businesses/${businessId}/online-sales`),
  update: (businessId: Id, body: OnlineSalesUpdate) =>
    apiClient.put<OnlineSalesSettings>(`/businesses/${businessId}/online-sales`, body),
  giftCards: (businessId: Id) => apiClient.get<GiftCardRow[]>(`/businesses/${businessId}/online-sales/gift-cards`),
  products: (businessId: Id) => apiClient.get<ShopProduct[]>(`/businesses/${businessId}/shop/products`),
  setSellOnline: (businessId: Id, productId: string, sellOnline: boolean) =>
    apiClient.put<{ sellOnline: boolean }>(`/businesses/${businessId}/shop/products/${productId}`, { sellOnline }),
  orders: (businessId: Id, status?: ShopOrderStatus) =>
    apiClient.get<ShopOrder[]>(`/businesses/${businessId}/shop/orders${status ? `?status=${status}` : ''}`),
  ready: (businessId: Id, orderId: string) =>
    apiClient.post<{ status: string }>(`/businesses/${businessId}/shop/orders/${orderId}/ready`, {}),
  pickedUp: (businessId: Id, orderId: string) =>
    apiClient.post<{ status: string }>(`/businesses/${businessId}/shop/orders/${orderId}/picked-up`, {}),
  cancel: (businessId: Id, orderId: string) =>
    apiClient.post<{ status: string }>(`/businesses/${businessId}/shop/orders/${orderId}/cancel`, {}),
  topUps: (businessId: Id, clientId: Id) =>
    apiClient.get<WalletTopUp[]>(`/clients/${clientId}/wallet/top-ups?businessId=${businessId}`),
  refundTopUp: (businessId: Id, clientId: Id, topUpId: string, amount?: number) =>
    apiClient.post<{ refunded: number; credit: number }>(
      `/clients/${clientId}/wallet/top-ups/${topUpId}/refund?businessId=${businessId}`,
      amount != null ? { amount } : {},
    ),
};
