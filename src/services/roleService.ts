import { apiClient } from "@/config/api";

export interface TeamPermissionInfo {
  key: string;
  group: string;
  label: string;
  description: string;
}

export interface BusinessRole {
  id: number;
  name: string;
  description?: string | null;
  isOwner: boolean;
  isDefault: boolean;
  permissions: string[];
  memberIds: number[];
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
  list: (businessId: number) => apiClient.get<BusinessRole[]>(`/businesses/${businessId}/roles`),
  create: (businessId: number, input: RoleInput) =>
    apiClient.post<BusinessRole>(`/businesses/${businessId}/roles`, input),
  update: (businessId: number, roleId: number, input: RoleInput) =>
    apiClient.put<BusinessRole>(`/businesses/${businessId}/roles/${roleId}`, input),
  remove: (businessId: number, roleId: number) =>
    apiClient.delete<void>(`/businesses/${businessId}/roles/${roleId}`),
  /** Give a team member one of the salon's roles (owner only). */
  assign: (staffId: number, roleId: number) => apiClient.put<BusinessRole>(`/staff/${staffId}/role`, { roleId }),
};
