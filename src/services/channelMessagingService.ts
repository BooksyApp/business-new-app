import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

/** SMS length/cost before a campaign, the WhatsApp reminder template, and the salon's message log. */
export interface SmsEstimate {
  encoding: "GSM7" | "UCS2";
  characters: number;
  perSegment: number;
  segmentsOfText: number;
  /** Segments of the whole message as sent (salon name and the STOP line included). */
  segmentsPerMessage: number;
  fullEncoding: "GSM7" | "UCS2";
  recipients: number;
  totalSegments: number;
  balance: number;
  balanceAfter: number;
  enough: boolean;
  unitPrice?: number;
  currency?: string;
  estimatedCost?: number;
}

export interface WhatsAppTemplate {
  name: string;
  language: "az" | "ru" | "en";
  body: string;
  parameters: string[];
  preview: string;
  available: boolean;
  balance: number;
}

export interface MessageLogRow {
  id: number;
  channel: "SMS" | "WHATSAPP";
  kind: string;
  recipient: string;
  body: string;
  segments: number;
  status: "SENT" | "FAILED" | "BLOCKED";
  error: string | null;
  created_at: string;
}

export interface ReminderDeliveryRow {
  booking_id: number;
  channel: string;
  status: "SENT" | "FAILED" | "SKIPPED";
  reason: string | null;
  created_at: string;
}

class MessagingService {
  estimate(businessId: Id, text: string, recipients: number): Promise<SmsEstimate> {
    return apiClient.post<SmsEstimate>(`/businesses/${businessId}/messaging/sms-estimate`, { text, recipients });
  }

  template(businessId: Id, lang: string): Promise<WhatsAppTemplate> {
    return apiClient.get<WhatsAppTemplate>(`/businesses/${businessId}/messaging/whatsapp-template?lang=${lang}`);
  }

  log(businessId: Id): Promise<{ messages: MessageLogRow[]; reminders: ReminderDeliveryRow[] }> {
    return apiClient.get(`/businesses/${businessId}/messaging/log?limit=30`);
  }
}

export const channelMessagingService = new MessagingService();
