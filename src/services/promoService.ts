import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

/**
 * #28: PromoController has had create / list / validate / deactivate since V24 and
 * nothing on the client ever called it, so a salon could not issue a promo code at all.
 * Rows come straight from `SELECT *` on promo_codes, hence the snake_case fields.
 */
export interface PromoCode {
  id: Id;
  business_id: Id;
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
  /** What a code takes off this subtotal, per the server. Throws if the code is not valid. */
  async validate(businessId: Id, code: string, subtotal: number): Promise<{ code: string; discount: number }> {
    return apiClient.get<{ code: string; discount: number }>(
      `/promo-codes/business/${businessId}/validate?code=${encodeURIComponent(code)}&subtotal=${subtotal}`
    );
  }

  async list(businessId: Id): Promise<PromoCode[]> {
    return apiClient.get<PromoCode[]>(`/promo-codes/business/${businessId}`);
  }

  async create(businessId: Id, body: PromoCodeRequest): Promise<PromoCode> {
    return apiClient.post<PromoCode>(`/promo-codes/business/${businessId}`, body);
  }

  /** The backend deactivates rather than deleting, so redeemed history stays intact. */
  async deactivate(businessId: Id, id: Id): Promise<void> {
    return apiClient.delete<void>(`/promo-codes/business/${businessId}/${id}`);
  }
}

export const promoService = new PromoService();
