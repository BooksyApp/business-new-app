import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

export interface Membership {
  id: Id;
  business_id: Id;
  name: string;
  description: string | null;
  price: number;
  billing_period_months: number;
  discount_percent: number;
  included_sessions: number;
  service_id: Id | null;
  service_name?: string | null;
  active: boolean;
}

export interface MembershipMember {
  id: Id;
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
  list(businessId: Id, activeOnly = false): Promise<Membership[]> {
    return apiClient.get<Membership[]>(
      `/businesses/${businessId}/memberships?activeOnly=${activeOnly}`
    );
  }

  create(businessId: Id, input: MembershipInput): Promise<Membership> {
    return apiClient.post<Membership>(`/businesses/${businessId}/memberships`, input);
  }

  update(businessId: Id, id: Id, input: Partial<MembershipInput>): Promise<Membership> {
    return apiClient.put<Membership>(`/businesses/${businessId}/memberships/${id}`, input);
  }

  /** Retires a plan. Existing members keep what they pay for; it stops being sold. */
  deactivate(businessId: Id, id: Id): Promise<void> {
    return apiClient.delete<void>(`/businesses/${businessId}/memberships/${id}`);
  }

  services(businessId: Id, id: Id): Promise<number[]> {
    return apiClient.get<number[]>(`/businesses/${businessId}/memberships/${id}/services`);
  }

  /** Replaces the services a plan covers. An empty list means every service. */
  setServices(businessId: Id, id: Id, serviceIds: Id[]): Promise<number[]> {
    return apiClient.put<number[]>(`/businesses/${businessId}/memberships/${id}/services`, { serviceIds });
  }

  members(businessId: Id): Promise<MembershipMember[]> {
    return apiClient.get<MembershipMember[]>(`/businesses/${businessId}/memberships/members`);
  }

  /** FG-W4-08: freeze a member's plan for some days; the renewal moves by the same days. */
  freeze(businessId: Id, id: Id, days: number): Promise<{ frozen: boolean; days: number }> {
    return apiClient.post(`/businesses/${businessId}/memberships/members/${id}/freeze`, { days });
  }
}

export const membershipService = new MembershipService();

export interface LoyaltySettings {
  pointsPerUnit: number | null;
  visitsForReward: number | null;
  rewardServiceId: Id | null;
}

/**
 * The salon's loyalty rules. Points-per-spend and the stamp card are separate programmes
 * on purpose: one rewards how much a client spends, the other how often they come back.
 */
class LoyaltySettingsService {
  get(businessId: Id): Promise<LoyaltySettings> {
    return apiClient.get<LoyaltySettings>(`/businesses/${businessId}/loyalty-settings`);
  }

  update(businessId: Id, settings: Partial<LoyaltySettings>): Promise<LoyaltySettings> {
    return apiClient.put<LoyaltySettings>(`/businesses/${businessId}/loyalty-settings`, settings);
  }
}

export interface LoyaltyCardHolder {
  client_id: Id;
  client_name: string;
  email: string | null;
  phone: string | null;
  visits_count: number;
  rewards_available: number;
  rewards_used: number;
  points_balance: number;
}

class LoyaltyCardService {
  holders(businessId: Id): Promise<LoyaltyCardHolder[]> {
    return apiClient.get<LoyaltyCardHolder[]>(`/businesses/${businessId}/loyalty-card/clients`);
  }

  /** Puts a client on the card. Idempotent. */
  add(businessId: Id, clientId: Id): Promise<{ added: boolean }> {
    return apiClient.post<{ added: boolean }>(
      `/businesses/${businessId}/loyalty-card/clients/${clientId}`,
      {}
    );
  }

  /** A stamp added or removed by hand — a visit taken on paper, or one added in error. */
  stamp(businessId: Id, clientId: Id, delta = 1) {
    return apiClient.post<{ visits: number; visitsForReward: number; rewardsAvailable: number }>(
      `/businesses/${businessId}/loyalty-card/clients/${clientId}/stamp`,
      { delta }
    );
  }
}

export const loyaltyCardService = new LoyaltyCardService();

export interface LoyaltyCard {
  id: Id;
  name: string;
  visits_required: number;
  reward_service_id: Id | null;
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
  id: Id;
  client_id: Id;
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
  list(businessId: Id): Promise<LoyaltyCard[]> {
    return apiClient.get<LoyaltyCard[]>(`/businesses/${businessId}/loyalty-cards`);
  }

  /** Creating a card gives it to every client on the books straight away. */
  create(
    businessId: Id,
    input: {
      name: string;
      visitsRequired: number;
      rewardServiceId?: Id | null;
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
  restyle(businessId: Id, cardId: Id, colorFrom: string, colorTo: string): Promise<LoyaltyCard> {
    return apiClient.put<LoyaltyCard>(`/businesses/${businessId}/loyalty-cards/${cardId}/style`, {
      colorFrom,
      colorTo,
    });
  }

  /** Ends a card. What people already earned stays earned. */
  deactivate(businessId: Id, cardId: Id): Promise<void> {
    return apiClient.delete<void>(`/businesses/${businessId}/loyalty-cards/${cardId}`);
  }

  holders(businessId: Id, cardId: Id): Promise<CardHolder[]> {
    return apiClient.get<CardHolder[]>(`/businesses/${businessId}/loyalty-cards/${cardId}/holders`);
  }

  addHolder(businessId: Id, cardId: Id, clientId: Id) {
    return apiClient.post(`/businesses/${businessId}/loyalty-cards/${cardId}/holders/${clientId}`, {});
  }

  stamp(businessId: Id, cardId: Id, clientId: Id, delta = 1) {
    return apiClient.post(
      `/businesses/${businessId}/loyalty-cards/${cardId}/holders/${clientId}/stamp`,
      { delta }
    );
  }
}

export const loyaltyCardsService = new LoyaltyCardsService();

export const loyaltySettingsService = new LoyaltySettingsService();
