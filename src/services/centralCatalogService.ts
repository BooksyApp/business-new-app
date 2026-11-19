import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

/** FG-W5-10: one planned change at one salon for one service. */
export interface CentralPlanRow {
  serviceId: Id;
  targetBusinessId: Id;
  serviceName: string;
  action: "CREATE" | "UPDATE" | "UNCHANGED" | "BLOCKED";
  reason?: string | null;
  priceAction: "SET" | "KEEP_LOCAL";
  overridden: boolean;
  currentPrice: number | string | null;
  newPrice: number | string | null;
  newDuration: number;
  categoryName?: string | null;
  categoryToCreate: boolean;
}

export interface CentralPushInput {
  serviceIds: Id[];
  targetBusinessIds: Id[];
  lockPrice: boolean;
}

export const centralCatalogService = {
  preview(sourceBusinessId: Id, input: CentralPushInput): Promise<CentralPlanRow[]> {
    return apiClient.post<CentralPlanRow[]>(`/catalog/central/preview?businessId=${encodeURIComponent(String(sourceBusinessId))}`, input);
  },

  apply(sourceBusinessId: Id, input: CentralPushInput): Promise<CentralPlanRow[]> {
    return apiClient.post<CentralPlanRow[]>(`/catalog/central/apply?businessId=${encodeURIComponent(String(sourceBusinessId))}`, input);
  },
};
