import { apiClient } from '@/config/api';
import type { Id } from '@/types/id';

/** Staff calendar subscription: the feed path holds the staff member's private token. */
export const calendarFeedService = {
  getFeedPath: (staffId: Id) =>
    apiClient.get<{ feedPath: string }>(`/calendar/staff/${staffId}/token`).then((r) => r.feedPath),
  regenerateFeedPath: (staffId: Id) =>
    apiClient.post<{ feedPath: string }>(`/calendar/staff/${staffId}/token/regenerate`, {}).then((r) => r.feedPath),
};
