import type { Appointment, ClientWithStats, Staff } from '@/lib/api';
import { toDay } from '@/lib/api';
import { addDays, toMin } from '@/lib/format';

/** Shared day maths of the v2 screens (Bu gün, Təqvim). */
export const live = (a: Appointment) => a.status !== 'CANCELLED' && a.status !== 'NO_SHOW';
export const nowMin = () => { const n = new Date(); return n.getHours() * 60 + n.getMinutes(); };
export const firstName = (s?: string | null) => (s ?? '').trim().split(/\s+/)[0] ?? '';
export const len = (a: Appointment) => Math.max(0, toMin(a.endTime) - toMin(a.startTime));
/** Working minutes a specialist is planned for in a day (no per-staff shift API on this screen): 8 h. */
export const SHIFT_MIN = 480;

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
    out.push({ revenue: day.reduce((s, a) => s + (a.price ?? 0), 0), bookings: day.length, occ: staffCount ? Math.min(1, mins / (staffCount * SHIFT_MIN)) : 0 });
  }
  return out;
}

/** Load of one specialist today (0..1) and booked hours. */
export function staffLoad(list: Appointment[], s: Staff) {
  const mins = list.filter((a) => String(a.staffId) === String(s.id) && live(a)).reduce((n, a) => n + len(a), 0);
  return { load: Math.min(1, mins / SHIFT_MIN), hours: Math.round(mins / 60) };
}

/** Photo of a client for big headers: the cover (when the API has one), else the avatar. */
export const clientPhoto = (c?: ClientWithStats | null) => (c as { coverUrl?: string } | undefined)?.coverUrl ?? c?.avatarUrl ?? null;
