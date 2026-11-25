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
  /** True for a client of the salon being worked in (only when searched with includeOwn). */
  ownSalon?: boolean;
}

/** One visit of a client in any of the owner's salons. */
export interface OwnerVisitRow {
  appointment_date: string;
  start_time: string;
  end_time?: string | null;
  status: string;
  price?: number | null;
  service_name?: string | null;
  staff_name?: string | null;
  salonId: Id;
  salon_name: string;
}

export const sharedClientService = {
  getSharing(): Promise<{ shareClients: boolean }> {
    return apiClient.get<{ shareClients: boolean }>("/clients/sharing");
  },

  setSharing(shareClients: boolean): Promise<{ shareClients: boolean }> {
    return apiClient.put<{ shareClients: boolean }>("/clients/sharing", { shareClients });
  },

  search(businessId: Id, q: string, includeOwn = false): Promise<SharedClientRow[]> {
    return apiClient.get<SharedClientRow[]>(
      `/clients/shared?businessId=${encodeURIComponent(String(businessId))}&q=${encodeURIComponent(q)}${includeOwn ? "&includeOwn=true" : ""}`,
    );
  },

  /** The client's visits across all the owner's salons (owner only; empty for anyone else). */
  visits(businessId: Id, clientId: Id): Promise<OwnerVisitRow[]> {
    return apiClient.get<OwnerVisitRow[]>(`/clients/shared/${encodeURIComponent(String(clientId))}/visits?businessId=${encodeURIComponent(String(businessId))}`);
  },

  adopt(businessId: Id, clientId: Id): Promise<{ id: Id }> {
    return apiClient.post<{ id: Id }>(`/clients/shared/${encodeURIComponent(String(clientId))}/adopt?businessId=${encodeURIComponent(String(businessId))}`, {});
  },
};
