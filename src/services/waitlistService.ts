import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

/**
 * salon-hub #45: the waitlist had no frontend surface at all. The backend only exposed
 * it under /api/customer/waitlist, scoped to the authenticated customer, so a salon
 * could not see who was waiting on it — while notifyWaitingClients was already emailing
 * those clients whenever a slot freed up.
 */
export interface WaitlistEntry {
  id: Id;
  businessId: Id;
  staffId: Id | null;
  serviceId: Id | null;
  clientName: string | null;
  clientEmail: string | null;
  clientPhone: string | null;
  preferredDate: string | null;
  status: string;
  /** What they are waiting for, and who for. The list used to carry ids only. */
  serviceName: string | null;
  staffName: string | null;
  createdAt: string | null;
}

class WaitlistService {
  async listForBusiness(businessId: Id): Promise<WaitlistEntry[]> {
    return apiClient.get<WaitlistEntry[]>(`/waitlist/business/${businessId}`);
  }

  /** Take someone off the list — booked elsewhere, or no longer waiting. */
  async remove(businessId: Id, id: Id): Promise<void> {
    return apiClient.delete<void>(`/waitlist/business/${businessId}/${id}`);
  }
}

export const waitlistService = new WaitlistService();
