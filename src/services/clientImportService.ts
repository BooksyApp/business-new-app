import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

/** One file row mapped to client fields (FG-W1-02). Empty fields are left out. */
export interface ImportRow {
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  email?: string;
  birthday?: string;
  note?: string;
  tags?: string;
}

export type ImportStatus = "NEW" | "MERGE_EXISTING" | "MERGE_IN_FILE" | "ERROR";

export interface ImportOutcome {
  row: number;
  status: ImportStatus;
  reason: string | null;
  name: string | null;
  phone: string | null;
  email: string | null;
  matchedName: string | null;
}

export interface ImportPlan {
  rows: ImportOutcome[];
  counts: Record<ImportStatus, number>;
}

export const clientImportService = {
  preview: (businessId: Id, rows: ImportRow[]) =>
    apiClient.post<ImportPlan>(`/clients/business/${businessId}/import/preview`, { rows }),
  run: (businessId: Id, rows: ImportRow[]) =>
    apiClient.post<ImportPlan>(`/clients/business/${businessId}/import`, { rows }),
};
