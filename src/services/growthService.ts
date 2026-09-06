import { apiClient } from "@/config/api";

/**
 * #28: gift cards, packages and loyalty all shipped complete on the backend
 * (GiftCardController, PackageController, LoyaltyController) with no caller anywhere.
 * Rows come from `SELECT *`, hence the snake_case fields.
 */
export interface GiftCard {
  id: number;
  code: string;
  amount: number;
  balance: number;
  status?: string;
  email?: string | null;
  expires_at?: string | null;
}

export interface ServicePackage {
  id: number;
  business_id: number;
  name: string;
  service_id: number | null;
  sessions_total: number;
  price: number;
  active: boolean;
}

export interface LoyaltyAccount {
  pointsBalance?: number;
  points_balance?: number;
  [key: string]: unknown;
}

class GiftCardService {
  /** Issue a card. The backend generates the code and returns it. */
  async issue(businessId: number, amount: number, email?: string): Promise<GiftCard> {
    return apiClient.post<GiftCard>(`/gift-cards`, { businessId, amount, email: email || undefined });
  }

  /** There is no list-by-business endpoint — a card is found by its code. */
  async lookup(code: string): Promise<GiftCard> {
    return apiClient.get<GiftCard>(`/gift-cards/${encodeURIComponent(code)}`);
  }
}

class PackageService {
  async list(businessId: number): Promise<ServicePackage[]> {
    return apiClient.get<ServicePackage[]>(`/packages/business/${businessId}`);
  }

  async create(businessId: number, body: {
    name: string; serviceId?: number; sessionsTotal: number; price: number; active?: boolean;
  }): Promise<ServicePackage> {
    return apiClient.post<ServicePackage>(`/packages/business/${businessId}`, body);
  }
}

class LoyaltyService {
  async account(businessId: number, clientId: number): Promise<LoyaltyAccount> {
    return apiClient.get<LoyaltyAccount>(`/loyalty/business/${businessId}/client/${clientId}`);
  }
}

export const giftCardService = new GiftCardService();
export const packageService = new PackageService();
export const loyaltyService = new LoyaltyService();
