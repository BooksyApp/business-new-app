import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

export interface TeamPermissionInfo {
  key: string;
  group: string;
  label: string;
  description: string;
}

export interface BusinessRole {
  id: Id;
  name: string;
  description?: string | null;
  isOwner: boolean;
  isDefault: boolean;
  permissions: string[];
  memberIds: Id[];
  memberCount: number;
}

export interface RoleInput {
  name: string;
  description?: string;
  permissions: string[];
  isDefault?: boolean;
}

export const roleService = {
  catalog: () => apiClient.get<TeamPermissionInfo[]>("/team-permissions"),
  list: (businessId: Id) => apiClient.get<BusinessRole[]>(`/businesses/${businessId}/roles`),
  create: (businessId: Id, input: RoleInput) =>
    apiClient.post<BusinessRole>(`/businesses/${businessId}/roles`, input),
  update: (businessId: Id, roleId: Id, input: RoleInput) =>
    apiClient.put<BusinessRole>(`/businesses/${businessId}/roles/${roleId}`, input),
  remove: (businessId: Id, roleId: Id) =>
    apiClient.delete<void>(`/businesses/${businessId}/roles/${roleId}`),
  /** Give a team member one of the salon's roles (owner only). */
  assign: (staffId: Id, roleId: Id) => apiClient.put<BusinessRole>(`/staff/${staffId}/role`, { roleId }),
};
