import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

export type TicketCategory = "BOOKING" | "PAYMENT" | "ACCOUNT" | "SALON_PROFILE" | "BUG" | "FEEDBACK" | "OTHER";
export type TicketStatus = "NEW" | "OPEN" | "WAITING_ON_USER" | "RESOLVED" | "CLOSED";

export const TICKET_CATEGORIES: TicketCategory[] = ["BOOKING", "PAYMENT", "ACCOUNT", "SALON_PROFILE", "BUG", "FEEDBACK", "OTHER"];

export interface SupportTicket {
  ref: string;
  requesterType: "CUSTOMER" | "BUSINESS_OWNER" | "STAFF" | "GUEST";
  category: TicketCategory;
  subject: string;
  status: TicketStatus;
  name: string | null;
  email: string;
  bookingRef: string | null;
  createdAt: string;
  updatedAt: string;
  lastMessageAt: string;
  resolvedAt: string | null;
}

export interface SupportMessage {
  id: Id;
  authorType: "USER" | "ADMIN" | "SYSTEM";
  authorName: string | null;
  body: string;
  createdAt: string;
}

export interface SupportThread {
  ticket: SupportTicket;
  messages: SupportMessage[];
}

/**
 * Support tickets for owners and team members. No businessId anywhere: the server works out
 * which salon a ticket belongs to from who is signed in, so a request cannot name another one.
 */
class SupportService {
  list(): Promise<SupportTicket[]> {
    return apiClient.get<SupportTicket[]>("/support/tickets");
  }

  get(ref: string): Promise<SupportThread> {
    return apiClient.get<SupportThread>(`/support/tickets/${encodeURIComponent(ref)}`);
  }

  create(body: { category: TicketCategory; subject: string; message: string; locale?: string }): Promise<SupportTicket> {
    return apiClient.post<SupportTicket>("/support/tickets", body);
  }

  reply(ref: string, body: string): Promise<SupportThread> {
    return apiClient.post<SupportThread>(`/support/tickets/${encodeURIComponent(ref)}/replies`, { body });
  }
}

export const supportService = new SupportService();
