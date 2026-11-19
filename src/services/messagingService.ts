import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

/** FG-W4-04: one conversation in the salon's inbox. */
export interface InboxSummary {
  conversationId: string;
  customerName: string;
  customerEmail: string;
  unread: number;
  lastMessageAt: string | null;
}

export interface InboxMessage {
  messageId: string;
  fromSalon: boolean;
  body: string;
  sentAt: string;
}

export interface InboxThread {
  conversationId: string;
  customerName: string;
  customerEmail: string;
  messages: InboxMessage[];
}

const base = (businessId: Id) => `/businesses/${encodeURIComponent(String(businessId))}/messages/conversations`;

export const messagingService = {
  list(businessId: Id): Promise<InboxSummary[]> {
    return apiClient.get<InboxSummary[]>(base(businessId));
  },

  get(businessId: Id, conversationId: string): Promise<InboxThread> {
    return apiClient.get<InboxThread>(`${base(businessId)}/${encodeURIComponent(conversationId)}`);
  },

  reply(businessId: Id, conversationId: string, body: string): Promise<InboxMessage> {
    return apiClient.post<InboxMessage>(`${base(businessId)}/${encodeURIComponent(conversationId)}/messages`, { body });
  },

  report(businessId: Id, conversationId: string, reason: string): Promise<{ reportId: string }> {
    return apiClient.post<{ reportId: string }>(`${base(businessId)}/${encodeURIComponent(conversationId)}/reports`, { reason });
  },
};
