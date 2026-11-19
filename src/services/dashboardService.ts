import { apiClient } from "@/config/api";
import type { Id } from "@/types/id";

/** A figure for the period and the period before it. */
export interface KpiPair {
  value: number;
  previous: number;
}

export type KpiKey =
  | "revenue"
  | "bookings"
  | "averageTicket"
  | "clients"
  | "newClients"
  | "returningClients"
  | "rebookingRate"
  | "noShowRate"
  | "cancellationRate"
  | "utilization"
  | "onlineShare";

export type SourceKey = "marketplace" | "widget" | "link" | "hub" | "other";

/** The channels, in the order the reports list them. */
export const SOURCE_KEYS: SourceKey[] = ["marketplace", "widget", "link", "hub", "other"];

export interface DashboardStaff {
  name: string;
  visits: number;
  revenue: number;
  bookedMinutes: number;
  availableMinutes: number;
  /** null when the team member has no working hours set. */
  utilization: number | null;
}

/** GET /analytics/business/{id}/dashboard (booksy-backend AnalyticsDashboardService). */
export interface Dashboard {
  period: { start: string; end: string };
  previousPeriod: { start: string; end: string };
  kpis: Record<KpiKey, KpiPair>;
  sources: { source: SourceKey; bookings: number }[];
  previousSources: { source: SourceKey; bookings: number }[];
  revenueTrend: { date: string; revenue: number; previous: number | null }[];
  topServices: { name: string; bookings: number; revenue: number }[];
  staff: DashboardStaff[];
  /** ISO weekday (1 = Monday) × start hour. */
  heatmap: { dow: number; hour: number; bookings: number }[];
  /** "2026-06": clients whose first visit was that month, and % back in each later month. */
  cohorts: { month: string; clients: number; retained: number[] }[];
}

export const dashboardService = {
  get(businessId: Id, startDate: string, endDate: string): Promise<Dashboard> {
    const p = new URLSearchParams({ startDate, endDate });
    try {
      p.set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
    } catch {
      /* UTC */
    }
    return apiClient.get<Dashboard>(`/analytics/business/${businessId}/dashboard?${p.toString()}`);
  },
};
