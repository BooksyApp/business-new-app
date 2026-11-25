import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

export interface ReferralCode {
  id: Id;
  code: string;
  businessId: Id;
  ownerId: Id;
  type: "CLIENT_REFERRAL" | "BUSINESS_REFERRAL" | "UNIVERSAL";
  status: "ACTIVE" | "INACTIVE" | "EXPIRED" | "SUSPENDED";
  description?: string;
  rewardAmount: number;
  rewardPoints: number;
  newUserReward: number;
  newUserPoints: number;
  maxUses?: number;
  currentUses: number;
  expiresAt?: string;
  createdAt: string;
  updatedAt?: string;
}

export interface ReferralUsage {
  id: Id;
  referralCodeId: Id;
  businessId: Id;
  usedByUserId: Id;
  referredClientId?: Id;
  referredBusinessId?: Id;
  status: "PENDING" | "REWARDED" | "FAILED" | "CANCELLED";
  rewardAmount?: number;
  rewardPoints?: number;
  newUserReward?: number;
  newUserPoints?: number;
  notes?: string;
  usedAt: string;
  rewardedAt?: string;
}

export interface ReferralAnalytics {
  businessId: Id;
  totalReferralCodes: number;
  activeReferralCodes: number;
  totalUsages: number;
  successfulUsages: number;
  totalRewardsGiven: number;
  totalRewardsEarned: number;
  totalPointsGiven: number;
  totalPointsEarned: number;
  totalReferredClients: number;
  totalReferredBusinesses: number;
}

export interface CreateReferralCodeRequest {
  businessId: Id;
  ownerId: Id;
  type: "CLIENT_REFERRAL" | "BUSINESS_REFERRAL" | "UNIVERSAL";
  description?: string;
  rewardAmount?: number;
  rewardPoints?: number;
  newUserReward?: number;
  newUserPoints?: number;
  maxUses?: number;
  expirationDays?: number;
}

export interface PlatformReferral {
  /** The one code, and the one share link (https://getbooqi.tech/r/<code>). */
  code: string;
  link: string;
  salons: { signedUp: number; paying: number; freeMonths: number };
  customers: { signedUp: number; booked: number };
  referrerPoints: number;
  newUserPoints: number;
  pending: number;
  qualified: number;
  pointsEarned: number;
  invites: { name: string; type: "CUSTOMER" | "SALON"; status: string; reward_points: number; created_at: string }[];
}

/** The salon's own "invite a salon" code (salon → salon, BUSINESS_REFERRAL) and what it earned. */
export interface SalonInvite {
  id: Id;
  code: string;
  rewardTier: string | null;
  invited: number;
  qualified: number;
  /** Free months earned; applied to the subscription once paid plans start. */
  monthsEarned: number;
  monthsApplied: number;
  paidPlansStarted: boolean;
}

class ReferralService {
  /** This salon's invite-a-salon code (created on first ask). */
  async getSalonInvite(businessId: Id): Promise<SalonInvite> {
    return apiClient.get<SalonInvite>(`/referrals/salon/business/${businessId}`);
  }

  /** A newly registered salon records the salon that invited it (?ref= on the register link). */
  async claimSalonInvite(businessId: Id, code: string): Promise<void> {
    await apiClient.post(`/referrals/salon/business/${businessId}/claim`, { code });
  }

  /**
   * The signed-in account's own booqi code. Every registered person has one — this is the
   * platform programme, not the salon's, so it needs no businessId and works for an owner
   * who has not set up a referral scheme of their own.
   */
  async getMyPlatformCode(): Promise<PlatformReferral> {
    return apiClient.get<PlatformReferral>("/referral/me");
  }

  /**
   * Get all referral codes for a business
   */
  async getReferralCodesByBusiness(businessId: Id): Promise<ReferralCode[]> {
    return apiClient.get<ReferralCode[]>(`/referrals/codes/business/${businessId}`);
  }

  /**
   * Get referral code by code string
   */
  async getReferralCodeByCode(code: string): Promise<ReferralCode> {
    return apiClient.get<ReferralCode>(`/referrals/codes/${code}`);
  }

  /**
   * Create a new referral code
   */
  async createReferralCode(request: CreateReferralCodeRequest): Promise<ReferralCode> {
    return apiClient.post<ReferralCode>("/referrals/codes", request);
  }

  /**
   * Get referral analytics for a business
   */
  async getAnalytics(businessId: Id): Promise<ReferralAnalytics> {
    return apiClient.get<ReferralAnalytics>(`/referrals/analytics/business/${businessId}`);
  }

  /**
   * Get referral usages for a business
   */
  async getReferralUsages(businessId: Id): Promise<ReferralUsage[]> {
    // Note: This endpoint might need to be added to the backend
    return apiClient.get<ReferralUsage[]>(`/referrals/usages/business/${businessId}`);
  }

  /**
   * Use a referral code
   */
  async useReferralCode(code: string, businessId: Id, userId: Id, referredClientId?: Id, referredBusinessId?: Id): Promise<ReferralUsage> {
    return apiClient.post<ReferralUsage>("/referrals/use", {
      code,
      businessId,
      userId,
      referredClientId,
      referredBusinessId,
    });
  }

  /**
   * Process reward for a referral usage
   */
  async processReward(usageId: Id): Promise<ReferralUsage> {
    return apiClient.put<ReferralUsage>(`/referrals/usages/${usageId}/process`, {});
  }

  /**
   * Get the universal referral code for a business owner
   */
  async getReferralCodeByOwner(ownerId: Id): Promise<ReferralCode | null> {
    try {
      return await apiClient.get<ReferralCode>(`/referrals/codes/owner/${ownerId}`);
    } catch (error) {
      return null;
    }
  }

  /**
   * Get the universal referral code for a business
   */
  async getBusinessUniversalCode(businessId: Id): Promise<ReferralCode | null> {
    try {
      return await apiClient.get<ReferralCode>(`/referrals/codes/business/${businessId}/universal`);
    } catch (error) {
      return null;
    }
  }
}

export const referralService = new ReferralService();

