import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

/** FG-W5-08: a client of another salon of the same owner, as the salon sees them. */
export interface SharedClientRow {
  id: Id;
  firstName: string;
  lastName?: string | null;
  phone?: string | null;
  email?: string | null;
  notes?: string | null;
  salonId: Id;
  salonName: string;
  visits: number | null;
  lastVisit: string | null;
  alreadyAdded: boolean;
}

export const sharedClientService = {
  getSharing(): Promise<{ shareClients: boolean }> {
    return apiClient.get<{ shareClients: boolean }>("/clients/sharing");
  },

  setSharing(shareClients: boolean): Promise<{ shareClients: boolean }> {
    return apiClient.put<{ shareClients: boolean }>("/clients/sharing", { shareClients });
  },

  search(businessId: Id, q: string): Promise<SharedClientRow[]> {
    return apiClient.get<SharedClientRow[]>(`/clients/shared?businessId=${encodeURIComponent(String(businessId))}&q=${encodeURIComponent(q)}`);
  },

  adopt(businessId: Id, clientId: Id): Promise<{ id: Id }> {
    return apiClient.post<{ id: Id }>(`/clients/shared/${encodeURIComponent(String(clientId))}/adopt?businessId=${encodeURIComponent(String(businessId))}`, {});
  },
};
