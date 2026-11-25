import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";
import { salonPath } from "@/lib/salonKey";

/**
 * #42: the Stripe subscription module shipped complete — status, checkout session,
 * webhook — with zero UI. A business could not subscribe or upgrade from the manager
 * app at all.
 */
export interface SubscriptionStatus {
  businessId: Id;
  planKey: string | null;
  /** NONE when the business has never subscribed. */
  status: string;
  currentPeriodEnd: string | null;
}

class SubscriptionService {
  async getStatus(businessId: Id): Promise<SubscriptionStatus> {
    return apiClient.get<SubscriptionStatus>(`/businesses/${businessId}/subscription`);
  }

  /** Plan keys come from server configuration — never hardcode a list here. */
  async getPlans(): Promise<string[]> {
    return apiClient.get<string[]>(`/subscriptions/plans`);
  }

  /** Returns the Stripe-hosted checkout URL the browser should be sent to. */
  async createCheckout(businessId: Id, planKey: string): Promise<string> {
    const origin = window.location.origin;
    const res = await apiClient.post<{ checkoutUrl: string }>(
      `/businesses/${businessId}/subscription/checkout`,
      {
        planKey,
        successUrl: `${origin}${salonPath(businessId, "business")}?subscribed=1`,
        cancelUrl: `${origin}${salonPath(businessId, "business")}?subscribed=0`,
      }
    );
    return res.checkoutUrl;
  }
}

export const subscriptionService = new SubscriptionService();
