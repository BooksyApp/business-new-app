import { apiClient } from "@/config/api";

export interface Membership {
  id: number;
  business_id: number;
  name: string;
  description: string | null;
  price: number;
  billing_period_months: number;
  discount_percent: number;
  included_sessions: number;
  service_id: number | null;
  service_name?: string | null;
  active: boolean;
}

export interface MembershipMember {
  id: number;
  status: string;
  started_at: string;
  renews_at: string;
  sessions_remaining: number;
  membership_name: string;
  price: number;
  client_name: string;
  client_email: string;
}

export interface MembershipInput {
  name: string;
  description?: string;
  price: number;
  billingPeriodMonths: number;
  discountPercent: number;
  includedSessions: number;
  active?: boolean;
}

/**
 * Memberships are recurring plans, not packages. A package is a block of sessions that
 * runs out; a membership renews and keeps paying out, which is why it has its own table,
 * its own page and a members list the salon can actually bill against.
 */
class MembershipService {
  list(businessId: number, activeOnly = false): Promise<Membership[]> {
    return apiClient.get<Membership[]>(
      `/businesses/${businessId}/memberships?activeOnly=${activeOnly}`
    );
  }

  create(businessId: number, input: MembershipInput): Promise<Membership> {
    return apiClient.post<Membership>(`/businesses/${businessId}/memberships`, input);
  }

  update(businessId: number, id: number, input: Partial<MembershipInput>): Promise<Membership> {
    return apiClient.put<Membership>(`/businesses/${businessId}/memberships/${id}`, input);
  }

  /** Retires a plan. Existing members keep what they pay for; it stops being sold. */
  deactivate(businessId: number, id: number): Promise<void> {
    return apiClient.delete<void>(`/businesses/${businessId}/memberships/${id}`);
  }

  services(businessId: number, id: number): Promise<number[]> {
    return apiClient.get<number[]>(`/businesses/${businessId}/memberships/${id}/services`);
  }

  /** Replaces the services a plan covers. An empty list means every service. */
  setServices(businessId: number, id: number, serviceIds: number[]): Promise<number[]> {
    return apiClient.put<number[]>(`/businesses/${businessId}/memberships/${id}/services`, { serviceIds });
  }

  members(businessId: number): Promise<MembershipMember[]> {
    return apiClient.get<MembershipMember[]>(`/businesses/${businessId}/memberships/members`);
  }
}

export const membershipService = new MembershipService();

export interface LoyaltySettings {
  pointsPerUnit: number | null;
  visitsForReward: number | null;
  rewardServiceId: number | null;
}

/**
 * The salon's loyalty rules. Points-per-spend and the stamp card are separate programmes
 * on purpose: one rewards how much a client spends, the other how often they come back.
 */
class LoyaltySettingsService {
  get(businessId: number): Promise<LoyaltySettings> {
    return apiClient.get<LoyaltySettings>(`/businesses/${businessId}/loyalty-settings`);
  }

  update(businessId: number, settings: Partial<LoyaltySettings>): Promise<LoyaltySettings> {
    return apiClient.put<LoyaltySettings>(`/businesses/${businessId}/loyalty-settings`, settings);
  }
}

export interface LoyaltyCardHolder {
  client_id: number;
  client_name: string;
  email: string | null;
  phone: string | null;
  visits_count: number;
  rewards_available: number;
  rewards_used: number;
  points_balance: number;
}

class LoyaltyCardService {
  holders(businessId: number): Promise<LoyaltyCardHolder[]> {
    return apiClient.get<LoyaltyCardHolder[]>(`/businesses/${businessId}/loyalty-card/clients`);
  }

  /** Puts a client on the card. Idempotent. */
  add(businessId: number, clientId: number): Promise<{ added: boolean }> {
    return apiClient.post<{ added: boolean }>(
      `/businesses/${businessId}/loyalty-card/clients/${clientId}`,
      {}
    );
  }

  /** A stamp added or removed by hand — a visit taken on paper, or one added in error. */
  stamp(businessId: number, clientId: number, delta = 1) {
    return apiClient.post<{ visits: number; visitsForReward: number; rewardsAvailable: number }>(
      `/businesses/${businessId}/loyalty-card/clients/${clientId}/stamp`,
      { delta }
    );
  }
}

export const loyaltyCardService = new LoyaltyCardService();

export interface LoyaltyCard {
  id: number;
  name: string;
  visits_required: number;
  reward_service_id: number | null;
  reward_service_name: string | null;
  valid_until: string | null;
  active: boolean;
  expired: boolean;
  color_from: string | null;
  color_to: string | null;
  icon: string | null;
  holders: number;
  rewards_waiting: number;
  rewards_used: number;
}

export interface CardHolder {
  id: number;
  client_id: number;
  client_name: string;
  email: string | null;
  phone: string | null;
  stamps: number;
  rewards_available: number;
  rewards_used: number;
}

/**
 * Stamp cards. A card is a row, not a setting: a salon runs several a year, each with its
 * own reward and closing date, and wants to see the ones it has already run.
 */
class LoyaltyCardsService {
  list(businessId: number): Promise<LoyaltyCard[]> {
    return apiClient.get<LoyaltyCard[]>(`/businesses/${businessId}/loyalty-cards`);
  }

  /** Creating a card gives it to every client on the books straight away. */
  create(
    businessId: number,
    input: {
      name: string;
      visitsRequired: number;
      rewardServiceId?: number | null;
      validUntil?: string | null;
      colorFrom?: string;
      colorTo?: string;
    }
  ): Promise<LoyaltyCard & { assignedTo: number }> {
    return apiClient.post<LoyaltyCard & { assignedTo: number }>(
      `/businesses/${businessId}/loyalty-cards`,
      input
    );
  }

  /** The card's look in the customer app. Colours only, so it stays readable. */
  restyle(businessId: number, cardId: number, colorFrom: string, colorTo: string): Promise<LoyaltyCard> {
    return apiClient.put<LoyaltyCard>(`/businesses/${businessId}/loyalty-cards/${cardId}/style`, {
      colorFrom,
      colorTo,
    });
  }

  /** Ends a card. What people already earned stays earned. */
  deactivate(businessId: number, cardId: number): Promise<void> {
    return apiClient.delete<void>(`/businesses/${businessId}/loyalty-cards/${cardId}`);
  }

  holders(businessId: number, cardId: number): Promise<CardHolder[]> {
    return apiClient.get<CardHolder[]>(`/businesses/${businessId}/loyalty-cards/${cardId}/holders`);
  }

  addHolder(businessId: number, cardId: number, clientId: number) {
    return apiClient.post(`/businesses/${businessId}/loyalty-cards/${cardId}/holders/${clientId}`, {});
  }

  stamp(businessId: number, cardId: number, clientId: number, delta = 1) {
    return apiClient.post(
      `/businesses/${businessId}/loyalty-cards/${cardId}/holders/${clientId}/stamp`,
      { delta }
    );
  }
}

export const loyaltyCardsService = new LoyaltyCardsService();

export const loyaltySettingsService = new LoyaltySettingsService();
