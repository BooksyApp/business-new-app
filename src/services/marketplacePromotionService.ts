import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

export interface MarketplacePromotion {
  promoted: boolean;
  /** Bookings that came in through the marketplace, one row per day for the last 14 days. */
  daily: { date: string; bookings: number }[];
}

/** FG-W4-11: the salon's marketplace promotion status (derived from an active promotion), and its marketplace bookings by day. */
class MarketplacePromotionService {
  get(businessId: Id): Promise<MarketplacePromotion> {
    return apiClient.get<MarketplacePromotion>(`/businesses/${businessId}/marketplace-promotion`);
  }
}

export const marketplacePromotionService = new MarketplacePromotionService();
