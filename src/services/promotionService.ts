import { apiClient } from '@/config/api';

/**
 * Paid placement: what it costs, whether any is left, and what the last one delivered.
 *
 * Hangs off /businesses/{id}/… like the money routes, because that prefix is already
 * tenant-checked on the server — one salon cannot buy placement, or read the results, for
 * another.
 */

export interface PromotionQuote {
  /** Whether the platform is selling it at all right now. */
  enabled: boolean;
  /** The smallest daily budget the platform will take. */
  minDaily: number;
  maxDays: number;
  maxPerList: number;
  countryCode: string | null;
  currency: string | null;
  /** Echoed back: what this quote was calculated for. */
  dailyBudget: number;
  days: number;
  total: number;
  endsOn: string;
  /**
   * Impressions a day at this rate, judged by what money bought in this country
   * yesterday. False when there is no history to judge from — the panel says so rather
   * than showing a number nobody can stand behind.
   */
  forecastKnown: boolean;
  forecastPerDay: number;
  /** A salon cannot stack two runs; this is what the panel branches on. */
  alreadyRunning: boolean;
}

export interface PromotionRow {
  id: number;
  startsAt: string;
  endsAt: string;
  /** The rate agreed, and what it totalled over the run. */
  dailyBudget: number;
  days: number;
  amount: number;
  currency: string | null;
  status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'ENDED' | 'CANCELLED';
  countryCode: string | null;
  impressions: number;
  clicks: number;
}

export interface PromotionDay {
  onDate: string;
  /** Where it was seen: 'home', 'list' or 'search'. */
  surface: string;
  impressions: number;
  clicks: number;
}

export const promotionService = {
  /**
   * What a daily budget is likely to buy. Re-read as the salon changes the number: the
   * whole point of a budget model is that the answer moves with it.
   */
  quote: (businessId: number, dailyBudget?: number, days = 7) => {
    const q = new URLSearchParams({ days: String(days) });
    if (dailyBudget != null) q.set('dailyBudget', String(dailyBudget));
    return apiClient.get<PromotionQuote>(`/businesses/${businessId}/promotion?${q.toString()}`);
  },

  /** Reserve a run. Returns it PENDING — placement starts once the money lands. */
  buy: (businessId: number, dailyBudget: number, days: number) =>
    apiClient.post<{ id: number; amount: number; currency: string | null; endsAt: string }>(
      `/businesses/${businessId}/promotion`,
      { dailyBudget, days }
    ),

  /** The Stripe page that pays for a reservation. */
  checkout: (businessId: number, promotionId: number, successUrl: string, cancelUrl: string) =>
    apiClient.post<{ checkoutUrl: string }>(
      `/businesses/${businessId}/promotion/${promotionId}/checkout`,
      { successUrl, cancelUrl }
    ),

  /** Stop delivering. Paused days are added back to the end when it resumes. */
  pause: (businessId: number, promotionId: number) =>
    apiClient.post<unknown>(`/businesses/${businessId}/promotion/${promotionId}/pause`, {}),

  resume: (businessId: number, promotionId: number) =>
    apiClient.post<unknown>(`/businesses/${businessId}/promotion/${promotionId}/resume`, {}),

  /** Change what a running campaign spends a day. Applies to the days still to come. */
  setBudget: (businessId: number, promotionId: number, dailyBudget: number) =>
    apiClient.post<unknown>(`/businesses/${businessId}/promotion/${promotionId}/budget`, {
      dailyBudget,
      days: 0,
    }),

  history: (businessId: number) =>
    apiClient.get<PromotionRow[]>(`/businesses/${businessId}/promotion/history`),

  daily: (businessId: number, promotionId: number) =>
    apiClient.get<PromotionDay[]>(`/businesses/${businessId}/promotion/${promotionId}/daily`),
};
