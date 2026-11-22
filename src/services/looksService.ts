import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

export type LookStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface Look {
  id: Id;
  photoUrl: string;
  title?: string | null;
  serviceId?: Id | null;
  serviceName?: string | null;
  staffId?: Id | null;
  staffName?: string | null;
  tags?: string[];
  status: LookStatus;
  rejectNote?: string | null;
}

export interface LookInput {
  title?: string;
  staffId?: Id | null;
  serviceId?: Id | null;
  tags?: string[];
}

/** Salon side of "looks". Business token, own salon only (the server checks the tenant). */
export const looksService = {
  list: (businessId: Id | string) => apiClient.get<Look[]>(`/businesses/${businessId}/looks`),
  create: (businessId: Id | string, upload: string, input: LookInput) =>
    apiClient.post<Look>(`/businesses/${businessId}/looks`, { upload, ...input }),
  update: (businessId: Id | string, lookId: Id, input: LookInput) =>
    apiClient.put<Look>(`/businesses/${businessId}/looks/${lookId}`, input),
  remove: (businessId: Id | string, lookId: Id) =>
    apiClient.delete<void>(`/businesses/${businessId}/looks/${lookId}`),
};
