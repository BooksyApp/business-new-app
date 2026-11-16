/**
 * The salon's wall clock (LR-09 follow-up).
 *
 * Appointment dates and times are salon-local. The calendar's "now" line, "today" and the
 * "is this in the past" guard used the browser's clock, so an owner whose laptop was on
 * another zone (or a phone abroad) saw the line hours off. These helpers return a plain
 * `Date` whose local fields (getHours, getDate, …) read as the salon's wall clock, so the
 * existing date-fns code keeps working unchanged.
 */
export const MARKET_TIME_ZONE = "Asia/Baku";

/**
 * The open salon's zone, set by useSalonTimeZone once the salon is loaded. The panel shows
 * one salon at a time, so helpers that are not hooks (date utilities, list filters) can use
 * it without every caller passing the zone through.
 */
let currentZone: string | null = null;
export function setCurrentSalonZone(tz: string | null | undefined): void {
  currentZone = tz || null;
}

/*
 * One formatter per zone, built once. The calendar asks "is this today?" for every column
 * and slot on each render; constructing up to three Intl.DateTimeFormat objects per call
 * was ~250 ms of main thread per day change on a 4x-throttled phone.
 */
const formatters = new Map<string, Intl.DateTimeFormat | null>();
function formatterFor(tz: string): Intl.DateTimeFormat | null {
  if (!formatters.has(tz)) {
    try {
      formatters.set(
        tz,
        new Intl.DateTimeFormat("en-US", {
          timeZone: tz,
          hourCycle: "h23",
          year: "numeric",
          month: "2-digit",
          day: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    } catch {
      formatters.set(tz, null); // not a zone this browser knows
    }
  }
  return formatters.get(tz) ?? null;
}

function validZone(tz?: string | null): string | null {
  if (!tz) return null;
  return formatterFor(tz) ? tz : null;
}

/** Now (or `at`) as the salon sees it, as a local-field Date. */
export function salonNow(tz?: string | null, at: Date = new Date()): Date {
  const zone = validZone(tz) ?? validZone(currentZone) ?? MARKET_TIME_ZONE;
  const parts = (formatterFor(zone) as Intl.DateTimeFormat).formatToParts(at);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(n("year"), n("month") - 1, n("day"), n("hour") % 24, n("minute"), n("second"));
}

/** The salon's today as YYYY-MM-DD (the open salon's zone when `tz` is not given). */
export function salonToday(tz?: string | null): string {
  const d = salonNow(tz);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** True when `day` is the salon's today. */
export function isSalonToday(day: Date, tz?: string | null): boolean {
  const now = salonNow(tz);
  return (
    day.getFullYear() === now.getFullYear() && day.getMonth() === now.getMonth() && day.getDate() === now.getDate()
  );
}
