import { apiClient } from "@/config/api";

/**
 * #28: PromoController has had create / list / validate / deactivate since V24 and
 * nothing on the client ever called it, so a salon could not issue a promo code at all.
 * Rows come straight from `SELECT *` on promo_codes, hence the snake_case fields.
 */
export interface PromoCode {
  id: number;
  business_id: number;
  code: string;
  type: "PERCENT" | "FIXED" | string;
  value: number;
  max_uses: number | null;
  uses: number;
  valid_from: string | null;
  valid_to: string | null;
  active: boolean;
}

export interface PromoCodeRequest {
  code: string;
  type: "PERCENT" | "FIXED";
  value: number;
  maxUses?: number;
  validFrom?: string;
  validTo?: string;
  active?: boolean;
}

class PromoService {
  async list(businessId: number): Promise<PromoCode[]> {
    return apiClient.get<PromoCode[]>(`/promo-codes/business/${businessId}`);
  }

  async create(businessId: number, body: PromoCodeRequest): Promise<PromoCode> {
    return apiClient.post<PromoCode>(`/promo-codes/business/${businessId}`, body);
  }

  /** The backend deactivates rather than deleting, so redeemed history stays intact. */
  async deactivate(businessId: number, id: number): Promise<void> {
    return apiClient.delete<void>(`/promo-codes/business/${businessId}/${id}`);
  }
}

export const promoService = new PromoService();
