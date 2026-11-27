import { ApiError } from '@/lib/api';
import { t as tr } from '@/i18n';

const KEY: Record<string, string> = {
  SLOT_TAKEN: 'cSlotTaken', DOUBLE_BOOKING: 'cSlotTaken', BUFFER_CONFLICT: 'cBuffer',
  OUTSIDE_HOURS: 'cHours', CLOSED_DAY: 'cClosed',
  STAFF_NOT_WORKING: 'cNotWorking', STAFF_OUTSIDE_SHIFT: 'cNotWorking',
  TIME_OFF: 'cTimeOff', STAFF_TIME_OFF: 'cTimeOff',
  BELOW_LEAD_TIME: 'cLead', MIN_LEAD_TIME: 'cLead',
  BEYOND_MAX_ADVANCE: 'cMaxAdv', MAX_ADVANCE: 'cMaxAdv',
  OFF_GRID: 'cOffGrid', STAFF_NOT_ASSIGNED: 'cNotAssigned',
};

/** Friendly localized text for a 409 booking error (public code or salon BOOKING_CONFLICTS types); the raw message otherwise. */
export function bookingErrorText(e: unknown): string {
  if (e instanceof ApiError && e.status === 409) {
    const d = e.data as { code?: string; conflicts?: { type?: string }[] } | null;
    const codes = [d?.code, ...(d?.conflicts ?? []).map((c) => c.type)].filter((c): c is string => !!c && !!KEY[c]);
    if (codes.length) return tr(`n4.${KEY[codes[0]]}` as Parameters<typeof tr>[0]);
  }
  return (e as Error)?.message || tr('common.error');
}
