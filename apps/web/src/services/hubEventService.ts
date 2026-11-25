import { apiClient } from "@/config/api";
import type { Id } from "@/types/id";

export type HubEventType = "BOOKING_NEW" | "BOOKING_CANCELLED" | "WAITLIST" | "REVIEW";

export interface HubEvent {
  id: string;
  type: HubEventType;
  at: string;
  who?: string | null;
  what?: string | null;
  date?: string | null;
  time?: string | null;
  rating?: number | null;
  unread: boolean;
}

export const hubEventService = {
  list(businessId: Id): Promise<{ unread: number; events: HubEvent[] }> {
    return apiClient.get(`/businesses/${businessId}/hub-events`);
  },
  markRead(businessId: Id): Promise<{ unread: number }> {
    return apiClient.post(`/businesses/${businessId}/hub-events/read`, {});
  },
};
