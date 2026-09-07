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

export const loyaltySettingsService = new LoyaltySettingsService();
