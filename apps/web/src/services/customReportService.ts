import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

/** FG-W5-07: the report builder. The server holds the whitelist; the hub only picks keys from it. */

export interface ReportColumnInfo {
  key: string;
  label: string;
  type: "text" | "number" | "money" | "date";
  /** Can be shown one row per record. */
  rowLevel: boolean;
  /** Can be totalled when the report is grouped. */
  aggregate: boolean;
}

export interface ReportDatasetInfo {
  key: string;
  label: string;
  columns: ReportColumnInfo[];
  groupBys: { key: string; label: string }[];
  /** A grouping the dataset always uses (staff performance: staff). */
  defaultGroupBy: string | null;
  /** Which filters the dataset understands: staff, service, status, source. */
  filters: string[];
  statuses: string[];
  sources: string[];
}

export interface ReportDefinition {
  dataset: string;
  columns: string[];
  groupBy: string | null;
  from: string | null;
  to: string | null;
  staffId: Id | null;
  serviceId: Id | null;
  statuses: string[];
  sources: string[];
}

export interface ReportResult {
  columns: { key: string; label: string; type: ReportColumnInfo["type"] }[];
  rows: (string | number | boolean | null)[][];
  truncated: boolean;
}

export interface SavedReport {
  id: string;
  name: string;
  definition: ReportDefinition | null;
  createdAt: string;
}

export const customReportService = {
  catalog(businessId: Id): Promise<ReportDatasetInfo[]> {
    return apiClient.get<ReportDatasetInfo[]>(`/businesses/${businessId}/custom-reports/catalog`);
  },
  run(businessId: Id, definition: ReportDefinition): Promise<ReportResult> {
    return apiClient.post<ReportResult>(`/businesses/${businessId}/custom-reports/run`, definition);
  },
  list(businessId: Id): Promise<SavedReport[]> {
    return apiClient.get<SavedReport[]>(`/businesses/${businessId}/custom-reports`);
  },
  save(businessId: Id, name: string, definition: ReportDefinition): Promise<{ id: string; name: string }> {
    return apiClient.post<{ id: string; name: string }>(`/businesses/${businessId}/custom-reports`, { name, definition });
  },
  remove(businessId: Id, reportId: string): Promise<void> {
    return apiClient.delete<void>(`/businesses/${businessId}/custom-reports/${reportId}`);
  },
};

/**
 * One CSV cell. A value that starts with = + - @ (or a tab/return) would run as a formula in a
 * spreadsheet, so it is prefixed with an apostrophe; quotes are doubled.
 */
export function csvCell(value: string | number | boolean | null): string {
  if (value === null || value === undefined) return "";
  let s = String(value);
  if (typeof value === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const BOM = String.fromCharCode(0xfeff);

export function toCsv(result: ReportResult): string {
  const lines = [result.columns.map((c) => csvCell(c.label)).join(",")];
  for (const row of result.rows) lines.push(row.map(csvCell).join(","));
  // BOM so Excel reads Azerbaijani and Russian letters as UTF-8.
  return `${BOM}${lines.join("\r\n")}\r\n`;
}
