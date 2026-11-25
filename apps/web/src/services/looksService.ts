import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

export type LookStatus = "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN";

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

export interface Story {
  id: Id;
  kind: "PHOTO" | "VIDEO";
  url: string;
  caption?: string | null;
  createdAt: string;
  expiresAt: string;
  viewCount: number;
}

/** Salon stories: a photo or short video that disappears after 24 hours. */
export const storiesService = {
  list: (businessId: Id | string) => apiClient.get<Story[]>(`/businesses/${businessId}/stories`),
  create: (businessId: Id | string, file: File, caption: string) => {
    const form = new FormData();
    form.append("file", file);
    if (caption.trim()) form.append("caption", caption.trim());
    return apiClient.upload<Story>(`/businesses/${businessId}/stories`, form);
  },
  remove: (businessId: Id | string, storyId: Id) =>
    apiClient.delete<void>(`/businesses/${businessId}/stories/${storyId}`),
};

export const looksSettingsService = {
  get: (businessId: Id | string) => apiClient.get<{ autoPublish: boolean }>(`/businesses/${businessId}/looks/settings`),
  set: (businessId: Id | string, autoPublish: boolean) =>
    apiClient.put<{ autoPublish: boolean }>(`/businesses/${businessId}/looks/settings`, { autoPublish }),
};
