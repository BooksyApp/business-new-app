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

function validZone(tz?: string | null): string | null {
  if (!tz) return null;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return null;
  }
}

/** Now (or `at`) as the salon sees it, as a local-field Date. */
export function salonNow(tz?: string | null, at: Date = new Date()): Date {
  const zone = validZone(tz) ?? MARKET_TIME_ZONE;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: zone,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const n = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  return new Date(n("year"), n("month") - 1, n("day"), n("hour") % 24, n("minute"), n("second"));
}

/** True when `day` is the salon's today. */
export function isSalonToday(day: Date, tz?: string | null): boolean {
  const now = salonNow(tz);
  return (
    day.getFullYear() === now.getFullYear() && day.getMonth() === now.getMonth() && day.getDate() === now.getDate()
  );
}
