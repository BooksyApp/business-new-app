import type { WaitlistEntry } from "@/services/waitlistService";

/** Minutes the first matching waiter has the freed slot to themselves (mirrors the backend). */
export const WAITLIST_HOLD_MINUTES = 15;
/** A freed-slot highlight fades from the calendar after this many hours. */
const FREED_VISIBLE_HOURS = 12;
/** A window is drawn at most this tall: a 9-to-18 wish must not cover the column. */
const MAX_WINDOW_MINUTES = 120;

export const toMinutes = (t: string): number => {
  const [h, m] = t.split(":");
  return parseInt(h, 10) * 60 + parseInt(m || "0", 10);
};

export const toHHmm = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

export const hhmm = (t?: string | null): string | null => (t ? t.slice(0, 5) : null);

export interface WaitingPlacement {
  /** Column to draw in; null = no specific master (goes to the slim strip). */
  staffId: string | null;
  /** Drawn block when we know a time; null = compact pill in the strip. */
  start: string | null;
  end: string | null;
  /** A cancellation freed a matching slot recently. */
  freed: boolean;
}

export function isFreed(w: WaitlistEntry, now: Date = new Date()): boolean {
  if (!w.slotFreedAt) return false;
  const at = new Date(w.slotFreedAt).getTime();
  return Number.isFinite(at) && now.getTime() - at < FREED_VISIBLE_HOURS * 3600_000;
}

/**
 * Where a waiting client belongs on the day grid.
 * - slot freed: the master and time that opened up (so the salon sees it where it happened);
 * - time window: at the window start, as tall as the window (capped, never shorter than the service);
 * - otherwise: no block; a pill in the strip (or on the master's column header if one is wanted).
 */
export function placeWaiting(w: WaitlistEntry, durationMin: number, now: Date = new Date()): WaitingPlacement {
  const freed = isFreed(w, now);
  const staffId = w.staffId ? String(w.staffId) : freed && w.freedStaffId ? String(w.freedStaffId) : null;
  const dur = Math.max(durationMin, 15);
  const freedStart = hhmm(w.freedStartTime);
  if (freed && freedStart && staffId) {
    return { staffId, start: freedStart, end: toHHmm(toMinutes(freedStart) + dur), freed };
  }
  const ws = hhmm(w.preferredStartTime);
  const we = hhmm(w.preferredEndTime);
  if (ws && we && toMinutes(we) > toMinutes(ws) && staffId) {
    const len = Math.min(Math.max(toMinutes(we) - toMinutes(ws), dur), MAX_WINDOW_MINUTES);
    return { staffId, start: ws, end: toHHmm(toMinutes(ws) + len), freed };
  }
  return { staffId, start: null, end: null, freed };
}

export interface BusyRange {
  staffId: string;
  start: string;
  end: string;
}

export interface SlotSuggestion {
  staffId: string;
  staffName: string;
  time: string;
  sameMaster: boolean;
}

export function isBusy(busy: BusyRange[], staffId: string, start: string, end: string): boolean {
  const s = toMinutes(start);
  const e = toMinutes(end);
  return busy.some((b) => b.staffId === staffId && s < toMinutes(b.end) && e > toMinutes(b.start));
}

/**
 * Nearest free starts (15-min grid) for the waiting client: first for their master, then for the
 * other masters who do the same service. Nearest means closest to the time they wanted.
 */
export function suggestSlots(opts: {
  masters: { id: string; name: string }[];
  preferredStaffId: string | null;
  busy: BusyRange[];
  dayStartMin: number;
  dayEndMin: number;
  durationMin: number;
  anchorMin: number;
  notBeforeMin?: number;
  perMaster?: number;
  maxOthers?: number;
}): { same: SlotSuggestion[]; others: SlotSuggestion[] } {
  const { masters, preferredStaffId, busy, dayStartMin, dayEndMin, durationMin, anchorMin } = opts;
  const floor = Math.max(dayStartMin, opts.notBeforeMin ?? 0);
  const perMaster = opts.perMaster ?? 3;
  const forMaster = (m: { id: string; name: string }): SlotSuggestion[] => {
    const found: SlotSuggestion[] = [];
    for (let t = Math.ceil(floor / 15) * 15; t + durationMin <= dayEndMin; t += 15) {
      if (!isBusy(busy, m.id, toHHmm(t), toHHmm(t + durationMin))) {
        found.push({ staffId: m.id, staffName: m.name, time: toHHmm(t), sameMaster: m.id === preferredStaffId });
      }
    }
    return found.sort((a, b) => Math.abs(toMinutes(a.time) - anchorMin) - Math.abs(toMinutes(b.time) - anchorMin)).slice(0, perMaster);
  };
  const same = preferredStaffId ? masters.filter((m) => m.id === preferredStaffId).flatMap(forMaster) : [];
  const others = masters
    .filter((m) => m.id !== preferredStaffId)
    .flatMap((m) => forMaster(m).slice(0, 1))
    .sort((a, b) => Math.abs(toMinutes(a.time) - anchorMin) - Math.abs(toMinutes(b.time) - anchorMin))
    .slice(0, opts.maxOthers ?? 3);
  return { same: same.sort((a, b) => toMinutes(a.time) - toMinutes(b.time)), others };
}

/** Digits only, for tel: and wa.me links. */
export function phoneDigits(phone?: string | null): string {
  return (phone || "").replace(/[^\d]/g, "");
}
