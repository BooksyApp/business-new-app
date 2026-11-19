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
  /** HH:mm[:ss] window the client can come in; null = any time that day. */
  preferredStartTime?: string | null;
  preferredEndTime?: string | null;
  /** The exact time the client tried to book when they joined. */
  preferredTime?: string | null;
  /** Salon switch: message this client automatically when a matching slot frees up. */
  autoNotify?: boolean;
  /** A matching slot freed up (cancellation): when, with whom, at what time. */
  slotFreedAt?: string | null;
  freedStaffId?: Id | null;
  freedStartTime?: string | null;
  holdUntil?: string | null;
  offeredAt?: string | null;
  /** Last day when the client asked for a range of days (preferredDate is the first). */
  preferredEndDate?: string | null;
  /** "MORNING,EVENING": the parts of the day the client can come in; empty = any time. */
  timeOfDay?: string | null;
  /** The salon added this person by hand. */
  addedBySalon?: boolean;
}

export interface WaitlistAddInput {
  serviceId: Id;
  staffId?: Id | null;
  clientName: string;
  clientEmail?: string;
  clientPhone?: string;
  preferredDate: string;
  preferredEndDate?: string;
  timeOfDay?: string[];
  preferredTime?: string;
}

export interface WaitlistOfferSlot {
  staffId: Id;
  date: string;
  startTime: string;
}

class WaitlistService {
  async listForBusiness(businessId: Id): Promise<WaitlistEntry[]> {
    return apiClient.get<WaitlistEntry[]>(`/waitlist/business/${businessId}`);
  }

  /** Put a client on the waitlist by hand (a phone call, a walk-in). */
  async add(businessId: Id, input: WaitlistAddInput): Promise<{ id: Id }> {
    return apiClient.post<{ id: Id }>(`/waitlist/business/${businessId}`, input);
  }

  async setAutoNotify(businessId: Id, id: Id, autoNotify: boolean): Promise<void> {
    return apiClient.patch<void>(`/waitlist/business/${businessId}/${id}`, { autoNotify });
  }

  /** Send the client 1-3 concrete times over the existing waitlist channels. */
  async offer(businessId: Id, id: Id, slots: WaitlistOfferSlot[]): Promise<void> {
    return apiClient.post<void>(`/waitlist/business/${businessId}/${id}/offer`, { slots });
  }

  /** Take someone off the list — booked elsewhere, or no longer waiting. */
  async remove(businessId: Id, id: Id): Promise<void> {
    return apiClient.delete<void>(`/waitlist/business/${businessId}/${id}`);
  }
}

export const waitlistService = new WaitlistService();
