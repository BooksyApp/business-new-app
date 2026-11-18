import type { Id } from "@/types/id";
import { apiClient } from '@/config/api';

/**
 * The salon's own marks on a client (FG-W2-05 tags, FG-W2-06 block). Tags are coloured by the
 * salon and can sit on several clients. A block stops online booking at this salon only.
 */

export interface ClientTag {
  id: Id;
  name: string;
  colour: string;
}

export interface ClientCrm {
  tags: ClientTag[];
  blocked: boolean;
  blockReason: string | null;
}

const base = (businessId: Id) => `/businesses/${businessId}`;

export const clientTagService = {
  tags: (businessId: Id) => apiClient.get<ClientTag[]>(`${base(businessId)}/client-tags`),
  createTag: (businessId: Id, tag: { name: string; colour: string }) =>
    apiClient.post<ClientTag>(`${base(businessId)}/client-tags`, tag),
  deleteTag: (businessId: Id, tagId: Id) => apiClient.delete<void>(`${base(businessId)}/client-tags/${tagId}`),
  clientCrm: (businessId: Id, clientId: Id) =>
    apiClient.get<ClientCrm>(`${base(businessId)}/clients/${clientId}/crm`),
  setClientTags: (businessId: Id, clientId: Id, tagIds: Id[]) =>
    apiClient.put<ClientCrm>(`${base(businessId)}/clients/${clientId}/tags`, { tagIds }),
  block: (businessId: Id, clientId: Id, reason: string) =>
    apiClient.put<ClientCrm>(`${base(businessId)}/clients/${clientId}/block`, { reason }),
  unblock: (businessId: Id, clientId: Id) =>
    apiClient.delete<ClientCrm>(`${base(businessId)}/clients/${clientId}/block`),
};
