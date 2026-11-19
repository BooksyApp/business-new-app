import { useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { format as isoFormat, startOfMonth, endOfMonth, subDays, subMonths } from "date-fns";
import { currencySymbol } from "@/lib/currency";
import { formatDate, formatNumber } from "@/i18n/format";
import { getLocale } from "@/i18n";

/** Reports' period and number formatting, shared by the dashboard and the drill-downs. */

/* ── period ─────────────────────────────────────────────────────────────── */

export const RANGES = ["7d", "30d", "90d", "mtd", "lastMonth", "12m"] as const;
export type RangeKey = (typeof RANGES)[number];

const iso = (d: Date) => isoFormat(d, "yyyy-MM-dd");

export function rangeDates(r: RangeKey, today = new Date()): { start: string; end: string } {
  switch (r) {
    case "7d":
      return { start: iso(subDays(today, 6)), end: iso(today) };
    case "90d":
      return { start: iso(subDays(today, 89)), end: iso(today) };
    case "mtd":
      return { start: iso(startOfMonth(today)), end: iso(today) };
    case "lastMonth": {
      const m = subMonths(today, 1);
      return { start: iso(startOfMonth(m)), end: iso(endOfMonth(m)) };
    }
    case "12m":
      return { start: iso(subDays(today, 364)), end: iso(today) };
    default:
      return { start: iso(subDays(today, 29)), end: iso(today) };
  }
}

/** The period lives in the address (?range=90d), so a drill-down and a shared link keep it. */
export function useReportPeriod() {
  const [params, setParams] = useSearchParams();
  const raw = params.get("range");
  const range: RangeKey = (RANGES as readonly string[]).includes(raw ?? "") ? (raw as RangeKey) : "30d";
  const { start, end } = useMemo(() => rangeDates(range), [range]);
  const setRange = (r: RangeKey) =>
    setParams(
      (p) => {
        const n = new URLSearchParams(p);
        if (r === "30d") n.delete("range");
        else n.set("range", r);
        return n;
      },
      { replace: true },
    );
  return { range, setRange, start, end, query: range === "30d" ? "" : `?range=${range}` };
}

/* ── numbers ────────────────────────────────────────────────────────────── */

export const loc = () => getLocale();
export const fmtInt = (n: number) => formatNumber(loc(), Math.round(n || 0));
export const fmtMoney = (n: number) =>
  `${formatNumber(loc(), n || 0, { maximumFractionDigits: Math.abs(n) >= 1000 ? 0 : 2, minimumFractionDigits: 0 })} ${currencySymbol()}`;
export const fmtPct = (n: number) => `${formatNumber(loc(), n || 0, { maximumFractionDigits: 1 })}%`;
export const fmtDay = (d: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }) =>
  formatDate(loc(), `${d}T12:00:00`, opts);
export const fmtPeriod = (p: { start: string; end: string }) =>
  `${fmtDay(p.start)} – ${fmtDay(p.end, { day: "numeric", month: "short", year: "numeric" })}`;

export type Unit = "money" | "int" | "pct";
export const fmtBy = (u: Unit, n: number) => (u === "money" ? fmtMoney(n) : u === "pct" ? fmtPct(n) : fmtInt(n));

