import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

/**
 * Setup listed Email, SMS and Push notifications with nothing behind them — no table, no
 * endpoint, no effect on what was sent. booksy-backend V80 added the storage and made the
 * sender honour it.
 */
export interface NotificationSettings {
  businessId: Id;
  emailConfirmation: boolean;
  emailReminder: boolean;
  emailCancellation: boolean;
  emailReschedule: boolean;
  emailWaitlist: boolean;
  emailReviewRequest: boolean;
  /** LR-01: email the salon when a customer books, cancels or moves a booking online. */
  salonAlerts?: boolean;
  reminderHoursBefore: number;
  smsEnabled: boolean;
  pushEnabled: boolean;
  senderName: string | null;
  replyTo: string | null;
  /** Whether this deployment has a provider behind the channel at all. */
  smsAvailable: boolean;
  pushAvailable: boolean;
}

/** FG-W3-11: one salon paragraph per booking email kind and language; "" means none. */
export type NotificationTextKind = "CONFIRMATION" | "REMINDER" | "CANCELLATION";
export type NotificationTextLocale = "az" | "en" | "ru";
export type NotificationTexts = Record<NotificationTextKind, Record<NotificationTextLocale, string>>;

class NotificationSettingsService {
  async get(businessId: Id): Promise<NotificationSettings> {
    return apiClient.get<NotificationSettings>(`/businesses/${businessId}/notification-settings`);
  }

  async save(businessId: Id, settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    return apiClient.put<NotificationSettings>(`/businesses/${businessId}/notification-settings`, settings);
  }

  async getTexts(businessId: Id): Promise<NotificationTexts> {
    return apiClient.get<NotificationTexts>(`/businesses/${businessId}/settings/notification-texts`);
  }

  async saveTexts(businessId: Id, texts: NotificationTexts): Promise<NotificationTexts> {
    return apiClient.put<NotificationTexts>(`/businesses/${businessId}/settings/notification-texts`, texts);
  }
}

export const notificationSettingsService = new NotificationSettingsService();
