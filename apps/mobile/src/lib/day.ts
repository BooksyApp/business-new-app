import type { Appointment, ClientWithStats, Staff } from '@/lib/api';
import { toDay } from '@/lib/api';
import { addDays, toMin } from '@/lib/format';
import { salonNowMin } from '@/lib/salonClock';

/** Shared day maths of the v2 screens (Bu gün, Təqvim). */
export const live = (a: Appointment) => a.status !== 'CANCELLED' && a.status !== 'NO_SHOW';
export const nowMin = salonNowMin; // the salon's clock, not the phone's
export const firstName = (s?: string | null) => (s ?? '').trim().split(/\s+/)[0] ?? '';
export const len = (a: Appointment) => Math.max(0, toMin(a.endTime) - toMin(a.startTime));
/** Working minutes a specialist is planned for in a day (no per-staff shift API on this screen): 8 h. */
export const SHIFT_MIN = 480; // fallback only: shiftMinutes() prefers the specialist's shift, then the salon's hours

/** The next client: first live booking today that has not ended and is not finished. */
export function nextUp(list: Appointment[]) {
  const n = nowMin();
  return list.filter((a) => live(a) && a.status !== 'COMPLETED' && toMin(a.endTime) > n).sort((a, b) => toMin(a.startTime) - toMin(b.startTime))[0] ?? null;
}

/** Per-day series for the KPI sparklines: revenue (sum of prices), bookings (count), occupancy (booked minutes / staff x 8h). */
export function series(appts: Appointment[], end: Date, days: number, staffCount: number) {
  const out: { revenue: number; bookings: number; occ: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = toDay(addDays(end, -i));
    const day = appts.filter((a) => a.appointmentDate.slice(0, 10) === d && live(a));
    const mins = day.reduce((s, a) => s + len(a), 0);
    // Revenue = money actually collected (paid bookings only), the same rule as Kassa and Reports; booked-but-unpaid is not income yet.
    out.push({ revenue: day.reduce((s, a) => s + (a.paymentStatus === 'PAID' ? a.price ?? 0 : 0), 0), bookings: day.length, occ: staffCount ? Math.min(1, mins / (staffCount * SHIFT_MIN)) : 0 });
  }
  return out;
}

const WEEKDAY = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
const span = (a?: string | null, b?: string | null) => (a && b ? Math.max(0, toMin(b) - toMin(a)) : 0);

/** Planned minutes of a specialist on `date`: their own shift that weekday; else the salon's hours that weekday; else the 8 h default. */
export function shiftMinutes(s: Staff, date: Date, salonHours?: { dayOfWeek: string; enabled: boolean; startTime: string | null; endTime: string | null }[] | null) {
  const d = WEEKDAY[date.getDay()];
  const own = span(s.workingHoursStart?.[d], s.workingHoursEnd?.[d]);
  if (own > 0) return own;
  const r = salonHours?.find((x) => x.dayOfWeek === d);
  const salon = r?.enabled ? span(r.startTime, r.endTime) : 0;
  return salon > 0 ? salon : SHIFT_MIN;
}

/** Load of one specialist on a day (0..1), booked minutes and the shift length the load is measured against. */
export function staffLoad(list: Appointment[], s: Staff, date: Date, salonHours?: Parameters<typeof shiftMinutes>[2]) {
  const mins = list.filter((a) => String(a.staffId) === String(s.id) && live(a)).reduce((n, a) => n + len(a), 0);
  const shift = shiftMinutes(s, date, salonHours);
  return { load: Math.min(1, mins / shift), mins, shift };
}

/** Photo of a client for big headers: the cover (when the API has one), else the avatar. */
export const clientPhoto = (c?: ClientWithStats | null) => (c as { coverUrl?: string } | undefined)?.coverUrl ?? c?.avatarUrl ?? null;
