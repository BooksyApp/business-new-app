import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

export interface ClientBenefits {
  points: number;
  visits: number;
  visitsForReward: number;
  rewardsAvailable: number;
  memberships: Array<{
    id: Id;
    membership_id: Id;
    name: string;
    discount_percent: number;
    included_sessions: number;
    sessions_remaining: number;
    renews_at: string;
    serviceIds: Id[];
  }>;
  packages: Array<{ id: Id; name: string; service_id: Id | null; sessions_remaining: number }>;
  giftCards: Array<{ code: string; balance: number }>;
}

/**
 * What a client can pay with, in one call.
 *
 * The checkout screen used to offer "Membership" and "Package" as payment methods with
 * nothing behind them — the cashier picked one and found out at confirm whether the client
 * actually had it. This is asked once, when the client is chosen, so unusable options are
 * never offered.
 */
class TillBenefitsService {
  get(businessId: Id, clientId: Id): Promise<ClientBenefits> {
    return apiClient.get<ClientBenefits>(`/businesses/${businessId}/clients/${clientId}/benefits`);
  }
}

export const tillBenefitsService = new TillBenefitsService();
