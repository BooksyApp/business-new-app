import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

/**
 * #46: MarketingPage shipped with hardcoded campaign names, open rates and revenue on a
 * screen an owner reads as their real marketing performance. These are the real endpoints.
 */
export interface Campaign {
  id: Id;
  businessId: Id;
  name: string;
  channel: "EMAIL" | "SMS";
  segment: "LAPSED_60D" | "LAPSED_90D" | "TOP_SPENDERS";
  subject: string | null;
  body: string;
  status: "DRAFT" | "QUEUED" | "SENT" | "FAILED" | "CANCELLED";
  recipientCount: number;
  /** Recipients already sent / still waiting: a big campaign is spread over days by daily email limits. */
  sentCount?: number;
  queuedCount?: number;
  createdAt: string | null;
}

/**
 * Segment size and reachable count are separate on purpose: "40 in segment, 6 reachable"
 * tells a salon it has a consent problem, which a single number would hide.
 */
export interface AudiencePreview {
  segment: string;
  channel: string;
  segmentSize: number;
  reachable: number;
}

class CampaignService {
  async list(businessId: Id): Promise<Campaign[]> {
    return apiClient.get<Campaign[]>(`/marketing/campaigns/business/${businessId}`);
  }

  async preview(businessId: Id, segment: string, channel: string): Promise<AudiencePreview> {
    return apiClient.get<AudiencePreview>(
      `/marketing/campaigns/business/${businessId}/preview?segment=${segment}&channel=${channel}`
    );
  }

  async create(businessId: Id, body: {
    name: string; channel: string; segment: string; subject?: string; body: string;
  }): Promise<Campaign> {
    return apiClient.post<Campaign>(`/marketing/campaigns/business/${businessId}`, body);
  }

  /** Freezes the recipient list. Delivery itself waits on backend #496. */
  async queue(businessId: Id, campaignId: Id): Promise<Campaign> {
    return apiClient.post<Campaign>(`/marketing/campaigns/business/${businessId}/${campaignId}/queue`, {});
  }
}

export const campaignService = new CampaignService();
