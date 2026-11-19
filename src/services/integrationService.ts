import type { Id } from "@/types/id";
import { apiClient } from "@/config/api";

/** FG-W5-11: API keys and webhooks (owner only). Secrets are in the create answer and nowhere else. */

export interface ApiKeyRow {
  id: string;
  name: string;
  prefix: string;
  scopes: string[];
  createdAt: string;
  lastUsedAt: string | null;
  revokedAt: string | null;
}

export interface WebhookRow {
  id: string;
  url: string;
  events: string[];
  active: boolean;
  createdAt: string;
  failedDeliveries: number;
}

export interface WebhookDelivery {
  id: string;
  event: string;
  status: "PENDING" | "SUCCESS" | "FAILED";
  attempts: number;
  statusCode: number | null;
  error: string | null;
  createdAt: string;
  deliveredAt: string | null;
  nextAttemptAt: string | null;
}

export const integrationService = {
  listKeys(businessId: Id): Promise<{ keys: ApiKeyRow[]; scopes: string[] }> {
    return apiClient.get(`/businesses/${businessId}/api-keys`);
  },
  createKey(businessId: Id, name: string, scopes: string[]): Promise<{ id: string; name: string; prefix: string; scopes: string[]; key: string }> {
    return apiClient.post(`/businesses/${businessId}/api-keys`, { name, scopes });
  },
  revokeKey(businessId: Id, keyId: string): Promise<void> {
    return apiClient.delete<void>(`/businesses/${businessId}/api-keys/${keyId}`);
  },

  listWebhooks(businessId: Id): Promise<{ webhooks: WebhookRow[]; events: string[] }> {
    return apiClient.get(`/businesses/${businessId}/webhooks`);
  },
  createWebhook(businessId: Id, url: string, events: string[]): Promise<{ id: string; url: string; events: string[]; secret: string }> {
    return apiClient.post(`/businesses/${businessId}/webhooks`, { url, events });
  },
  updateWebhook(businessId: Id, id: string, body: { events: string[]; active: boolean }): Promise<void> {
    return apiClient.put<void>(`/businesses/${businessId}/webhooks/${id}`, body);
  },
  deleteWebhook(businessId: Id, id: string): Promise<void> {
    return apiClient.delete<void>(`/businesses/${businessId}/webhooks/${id}`);
  },
  testWebhook(businessId: Id, id: string): Promise<void> {
    return apiClient.post<void>(`/businesses/${businessId}/webhooks/${id}/test`);
  },
  deliveries(businessId: Id, id: string): Promise<WebhookDelivery[]> {
    return apiClient.get(`/businesses/${businessId}/webhooks/${id}/deliveries?limit=50`);
  },
};
