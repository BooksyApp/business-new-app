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

export type ClientFieldType = "TEXT" | "NUMBER" | "DATE" | "SELECT";

/** A salon-defined custom client field (FG-W2-05); `value` is set when read for one client. */
export interface ClientField {
  id: Id;
  name: string;
  type: ClientFieldType;
  options: string[];
  value?: string | null;
}

const base = (businessId: Id) => `/businesses/${businessId}`;

export const clientTagService = {
  tags: (businessId: Id) => apiClient.get<ClientTag[]>(`${base(businessId)}/client-tags`),
  createTag: (businessId: Id, tag: { name: string; colour: string }) =>
    apiClient.post<ClientTag>(`${base(businessId)}/client-tags`, tag),
  updateTag: (businessId: Id, tagId: Id, tag: { name: string; colour: string }) =>
    apiClient.put<ClientTag>(`${base(businessId)}/client-tags/${tagId}`, tag),
  deleteTag: (businessId: Id, tagId: Id) => apiClient.delete<void>(`${base(businessId)}/client-tags/${tagId}`),
  clientCrm: (businessId: Id, clientId: Id) =>
    apiClient.get<ClientCrm>(`${base(businessId)}/clients/${clientId}/crm`),
  setClientTags: (businessId: Id, clientId: Id, tagIds: Id[]) =>
    apiClient.put<ClientCrm>(`${base(businessId)}/clients/${clientId}/tags`, { tagIds }),
  block: (businessId: Id, clientId: Id, reason: string) =>
    apiClient.put<ClientCrm>(`${base(businessId)}/clients/${clientId}/block`, { reason }),
  unblock: (businessId: Id, clientId: Id) =>
    apiClient.delete<ClientCrm>(`${base(businessId)}/clients/${clientId}/block`),
  fields: (businessId: Id) => apiClient.get<ClientField[]>(`${base(businessId)}/client-fields`),
  createField: (businessId: Id, f: { name: string; type: ClientFieldType; options?: string[] }) =>
    apiClient.post<ClientField>(`${base(businessId)}/client-fields`, f),
  updateField: (businessId: Id, fieldId: Id, f: { name: string; options?: string[] }) =>
    apiClient.put<ClientField>(`${base(businessId)}/client-fields/${fieldId}`, f),
  deleteField: (businessId: Id, fieldId: Id) => apiClient.delete<void>(`${base(businessId)}/client-fields/${fieldId}`),
  clientFields: (businessId: Id, clientId: Id) =>
    apiClient.get<ClientField[]>(`${base(businessId)}/clients/${clientId}/fields`),
  setClientFields: (businessId: Id, clientId: Id, values: Record<string, string>) =>
    apiClient.put<ClientField[]>(`${base(businessId)}/clients/${clientId}/fields`, { values }),
  /** Public ids of the clients that carry the tag and/or match the field value. */
  filterClients: (businessId: Id, q: { tagId?: Id; fieldId?: Id; value?: string }) => {
    const p = new URLSearchParams();
    if (q.tagId) p.set("tagId", String(q.tagId));
    if (q.fieldId) p.set("fieldId", String(q.fieldId));
    if (q.value) p.set("value", q.value);
    return apiClient.get<{ clientIds: string[] }>(`${base(businessId)}/clients/filter?${p.toString()}`);
  },
};
