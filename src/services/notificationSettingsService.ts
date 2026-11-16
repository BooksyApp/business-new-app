import { apiClient } from "@/config/api";

/**
 * Setup listed Email, SMS and Push notifications with nothing behind them — no table, no
 * endpoint, no effect on what was sent. booksy-backend V80 added the storage and made the
 * sender honour it.
 */
export interface NotificationSettings {
  businessId: number;
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

class NotificationSettingsService {
  async get(businessId: number): Promise<NotificationSettings> {
    return apiClient.get<NotificationSettings>(`/businesses/${businessId}/notification-settings`);
  }

  async save(businessId: number, settings: Partial<NotificationSettings>): Promise<NotificationSettings> {
    return apiClient.put<NotificationSettings>(`/businesses/${businessId}/notification-settings`, settings);
  }
}

export const notificationSettingsService = new NotificationSettingsService();
