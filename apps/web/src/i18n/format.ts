/**
 * Date / number formatting for the panel. Chrome ships without Azerbaijani Intl data
 * (it falls back to "2026 M11 16, Mon"), so for "az" the month and day names are built
 * by hand from numeric parts, which every browser has. en / ru go through Intl.
 */
import type { HubLocale } from "@/lib/hubLocale";

const INTL_TAG: Record<HubLocale, string> = { az: "az-AZ", en: "en-GB", ru: "ru-RU" };

const AZ_MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
const AZ_MONTHS_SHORT = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avq", "sen", "okt", "noy", "dek"];
const AZ_DAYS = ["bazar", "bazar ertəsi", "çərşənbə axşamı", "çərşənbə", "cümə axşamı", "cümə", "şənbə"];
const AZ_DAYS_SHORT = ["B.", "B.e.", "Ç.a.", "Ç.", "C.a.", "C.", "Ş."];

type Fmt = { format: (d: Date) => string };

function azFormatter(opts: Intl.DateTimeFormatOptions): Fmt {
  // Built once per formatter, not per call: constructing an Intl.DateTimeFormat costs far
  // more than formatting with one, and the calendar formats hundreds of dates per render.
  const numeric = new Intl.DateTimeFormat("en-US", {
    timeZone: opts.timeZone,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  return {
    format(d: Date) {
      // Numeric parts in the requested zone (or local), via en-US which every browser has.
      const parts = numeric.formatToParts(d);
      const p: Record<string, string> = {};
      for (const x of parts) p[x.type] = x.value;
      const m = Number(p.month) - 1;
      // weekday from the same calendar date, so a timeZone option cannot skew it
      const wd = new Date(Date.UTC(Number(p.year), m, Number(p.day))).getUTCDay();
      const longMonth = opts.month === "long";
      const monthName = opts.month && opts.month !== "numeric" && opts.month !== "2-digit" ? (longMonth ? AZ_MONTHS : AZ_MONTHS_SHORT)[m] : opts.month ? String(m + 1) : "";
      const dayName = opts.weekday ? (opts.weekday === "long" ? AZ_DAYS : AZ_DAYS_SHORT)[wd] : "";
      let date = "";
      if (opts.day && opts.month) date = `${Number(p.day)} ${monthName}`;
      else if (opts.month) date = monthName;
      else if (opts.day) date = String(Number(p.day));
      if (opts.year) date = date ? `${date} ${p.year}` : p.year;
      const time = opts.hour || opts.minute ? `${p.hour === "24" ? "00" : p.hour}:${p.minute}` : "";
      return [date, dayName, time].filter(Boolean).join(", ");
    },
  };
}

const cache = new Map<string, Fmt>();

function make(locale: HubLocale, opts: Intl.DateTimeFormatOptions): Fmt {
  const k = locale + JSON.stringify(opts);
  let f = cache.get(k);
  if (!f) {
    f = locale === "az" ? azFormatter(opts) : new Intl.DateTimeFormat(INTL_TAG[locale], opts);
    cache.set(k, f);
  }
  return f;
}

/** Format a date with Intl-style options in the given locale (az handled by hand). */
export function formatDate(locale: HubLocale, d: Date | string | number, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  const date = d instanceof Date ? d : new Date(d);
  if (Number.isNaN(date.getTime())) return "";
  return make(locale, opts).format(date);
}

/** Format a number in the given locale. */
export function formatNumber(locale: HubLocale, n: number, opts?: Intl.NumberFormatOptions): string {
  const k = `n${locale}${JSON.stringify(opts ?? {})}`;
  let f = cache.get(k) as unknown as Intl.NumberFormat | undefined;
  if (!f) {
    f = new Intl.NumberFormat(INTL_TAG[locale], opts);
    cache.set(k, f as unknown as Fmt);
  }
  return f.format(n);
}
