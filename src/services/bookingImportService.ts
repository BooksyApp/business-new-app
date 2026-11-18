import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

/** One file row mapped to booking fields (FG-W2-03). Empty fields are left out. */
export interface BookingImportRow {
  date?: string;
  startTime?: string;
  endTime?: string;
  staffId?: Id;
  serviceId?: Id;
  clientName?: string;
  clientPhone?: string;
  clientEmail?: string;
  price?: string;
  note?: string;
}

export type BookingImportStatus = "NEW" | "CONFLICT" | "ERROR";

export interface BookingImportOutcome {
  row: number;
  status: BookingImportStatus;
  reason: string | null;
  date: string | null;
  startTime: string | null;
  endTime: string | null;
  clientName: string | null;
}

export interface BookingImportPlan {
  rows: BookingImportOutcome[];
  counts: Record<BookingImportStatus, number>;
}

export const bookingImportService = {
  preview: (businessId: Id, rows: BookingImportRow[]) =>
    apiClient.post<BookingImportPlan>(`/bookings/business/${businessId}/import/preview`, { rows }),
  run: (businessId: Id, rows: BookingImportRow[]) =>
    apiClient.post<BookingImportPlan>(`/bookings/business/${businessId}/import`, { rows }),
};
