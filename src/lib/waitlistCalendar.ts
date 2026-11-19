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
  /** Column to draw in. Null only when the salon has no master who could take them. */
  staffId: string | null;
  start: string | null;
  end: string | null;
  /** A cancellation freed a matching slot recently. */
  freed: boolean;
  /** The client did not choose a master: drawn on the first suitable one, marked "any master". */
  anyMaster: boolean;
}

export interface PlaceContext {
  /** Masters, in calendar order, who do this service and work that day. */
  masters: string[];
  /** Salon opening time that day, in minutes: the last-resort start. */
  openMin: number;
}

export function isFreed(w: WaitlistEntry, now: Date = new Date()): boolean {
  if (!w.slotFreedAt) return false;
  const at = new Date(w.slotFreedAt).getTime();
  return Number.isFinite(at) && now.getTime() - at < FREED_VISIBLE_HOURS * 3600_000;
}

/**
 * Where a waiting client belongs on the day grid. EVERY waiter is a block in a master's column:
 * - master: the one they chose; else the master whose slot freed; else the first master (calendar
 *   order) who does the service and works that day, marked "any master";
 * - start: the freed slot, else their window start, else the time they tried to book, else the
 *   salon's opening time that day;
 * - length: their window (capped, never shorter than the service), else the service duration.
 */
export function placeWaiting(w: WaitlistEntry, durationMin: number, ctx: PlaceContext, now: Date = new Date()): WaitingPlacement {
  const freed = isFreed(w, now);
  const anyMaster = !w.staffId;
  const staffId = w.staffId
    ? String(w.staffId)
    : freed && w.freedStaffId
      ? String(w.freedStaffId)
      : ctx.masters[0] ?? null;
  const dur = Math.max(durationMin, 15);
  if (!staffId) return { staffId: null, start: null, end: null, freed, anyMaster };
  const freedStart = hhmm(w.freedStartTime);
  if (freed && freedStart) {
    return { staffId, start: freedStart, end: toHHmm(toMinutes(freedStart) + dur), freed, anyMaster };
  }
  const ws = hhmm(w.preferredStartTime);
  const we = hhmm(w.preferredEndTime);
  if (ws && we && toMinutes(we) > toMinutes(ws)) {
    const len = Math.min(Math.max(toMinutes(we) - toMinutes(ws), dur), MAX_WINDOW_MINUTES);
    return { staffId, start: ws, end: toHHmm(toMinutes(ws) + len), freed, anyMaster };
  }
  const tried = hhmm(w.preferredTime);
  const startMin = tried ? toMinutes(tried) : ctx.openMin;
  const endMin = Math.min(startMin + dur, 24 * 60 - 1);
  return { staffId, start: toHHmm(startMin), end: toHHmm(endMin), freed, anyMaster };
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
