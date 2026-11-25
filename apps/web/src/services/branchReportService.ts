import { apiClient } from '@/config/api';

/** FG-W5-09: one row per salon the signed-in owner runs (their "branches"). */
export interface SalonComparisonRow {
  id: string;
  name: string;
  revenue: number | string | null;
  bookings: number | null;
  cancellations: number | null;
  noShows: number | null;
  newClients: number | null;
  averageTicket: number | string | null;
}

export const branchReportService = {
  compare(startDate?: string, endDate?: string): Promise<SalonComparisonRow[]> {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const qs = params.toString();
    return apiClient.get<SalonComparisonRow[]>(`/analytics/owner/branch-comparison${qs ? `?${qs}` : ''}`);
  },
};
