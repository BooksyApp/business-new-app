import type { Id } from "@/types/id";
import { apiClient } from '@/config/api';

/**
 * Paid placement: what it costs, whether any is left, and what the last one delivered.
 *
 * Hangs off /businesses/{id}/… like the money routes, because that prefix is already
 * tenant-checked on the server — one salon cannot buy placement, or read the results, for
 * another.
 */

/** A fixed-price placement the salon can buy: a number of days at a set price. */
export interface PromotionPackage {
  id: Id;
  nameAz: string;
  nameEn: string;
  nameRu: string;
  days: number;
  price: number;
  currency: string | null;
  overridden?: boolean;
  defaultPrice?: number;
  defaultCurrency?: string;
  forecastKnown: boolean;
  forecastPerDay: number;
}

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
  /** What can be bought. Fixed packages replaced the daily-budget model. */
  packages: PromotionPackage[];
}

export interface PromotionRow {
  id: Id;
  startsAt: string;
  endsAt: string;
  /** The rate agreed, and what it totalled over the run. */
  dailyBudget: number;
  days: number;
  amount: number;
  currency: string | null;
  /** 'FREE_GRANT': booqi gave this run to the salon, nothing was paid. */
  source: 'PAID' | 'FREE_GRANT';
  status: 'PENDING' | 'ACTIVE' | 'PAUSED' | 'ENDED' | 'CANCELLED';
  countryCode: string | null;
  /** Viewable impressions only: half the card in view for a second, in a visible tab. */
  impressions: number;
  clicks: number;
  /** People (not views) who saw it. */
  uniqueViewers: number;
  /** Clicks that had no viewable impression behind them: counted, but marked for review. */
  flaggedClicks: number;
  /** Bookings credited to this promotion (the customer's last click within 7 days). */
  bookings: number;
  /** Bots, own team, prefetch, expired or forged events thrown away, and plain repeats. */
  filteredInvalid: number;
  duplicates: number;
  /** clicks / impressions as a fraction (0.0123 = 1.23%); null before the first impression. */
  ctr: number | null;
  costPerClick: number | null;
  costPerBooking: number | null;
  /** Money, pro-rated to the minute by the backend (the salon's currency). */
  paidAmount: number;
  spentAmount: number;
  remainingAmount: number;
  daysLeft: number;
}

export interface PromotionDay {
  onDate: string;
  impressions: number;
  clicks: number;
  uniqueViewers: number;
  bookings: number;
  filteredInvalid: number;
}

export const promotionService = {
  /** The packages on sale, and whether placement is on at all. */
  quote: (businessId: Id) => apiClient.get<PromotionQuote>(`/businesses/${businessId}/promotion`),

  /** Reserve a package. Returns it PENDING — placement starts once the money lands. */
  buy: (businessId: Id, packageId: Id) =>
    apiClient.post<{ id: Id; amount: number; currency: string | null; endsAt: string }>(
      `/businesses/${businessId}/promotion`,
      { packageId }
    ),

  /** The Stripe page that pays for a reservation. */
  checkout: (businessId: Id, promotionId: Id, successUrl: string, cancelUrl: string) =>
    apiClient.post<{ checkoutUrl: string }>(
      `/businesses/${businessId}/promotion/${promotionId}/checkout`,
      { successUrl, cancelUrl }
    ),

  /** Drop a reservation that was never paid for, so a new campaign can be started. */
  discard: (businessId: Id, promotionId: Id) =>
    apiClient.post<unknown>(`/businesses/${businessId}/promotion/${promotionId}/discard`, {}),

  /** Stop delivering. Paused days are added back to the end when it resumes. */
  pause: (businessId: Id, promotionId: Id) =>
    apiClient.post<unknown>(`/businesses/${businessId}/promotion/${promotionId}/pause`, {}),

  resume: (businessId: Id, promotionId: Id) =>
    apiClient.post<unknown>(`/businesses/${businessId}/promotion/${promotionId}/resume`, {}),

  history: (businessId: Id) =>
    apiClient.get<PromotionRow[]>(`/businesses/${businessId}/promotion/history`),

  daily: (businessId: Id, promotionId: Id) =>
    apiClient.get<PromotionDay[]>(`/businesses/${businessId}/promotion/${promotionId}/daily`),
};
