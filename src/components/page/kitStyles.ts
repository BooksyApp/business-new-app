import { salonToday } from "@/lib/salonClock";
import { t, fmtDate as formatLocaleDate } from "@/i18n";
/** Non-component helpers for ./kit.tsx (kept apart for fast refresh). */

export type Lifecycle = "active" | "scheduled" | "ended" | "draft" | "queued" | "failed" | "paused";

/** Where a dated thing sits today. Dates are YYYY-MM-DD or ISO date-times. */
export function lifecycleOf(opts: { active?: boolean; from?: string | null; to?: string | null; exhausted?: boolean }): Lifecycle {
  if (opts.active === false || opts.exhausted) return "ended";
  const today = salonToday(); // LR-09: the salon's day; toISOString was UTC
  if (opts.to && opts.to.slice(0, 10) < today) return "ended";
  if (opts.from && opts.from.slice(0, 10) > today) return "scheduled";
  return "active";
}

/** "3 Nov – 30 Nov", "From 3 Nov", "Until 30 Nov", or the fallback. */
export function dateRange(from?: string | null, to?: string | null, fallback = t("kit.noEndDate")): string {
  const f = (d: string) => formatLocaleDate(new Date(d.slice(0, 10) + "T12:00:00"), { day: "numeric", month: "short" });
  if (from && to) return `${f(from)} – ${f(to)}`;
  if (from) return t("kit.from", { value: f(from) });
  if (to) return t("kit.until", { value: f(to) });
  return fallback;
}

export const fieldCls =
  "h-12 w-full rounded-[14px] border border-[rgb(var(--reg-line))] bg-white px-4 text-base text-[rgb(var(--reg-ink))] placeholder:text-[rgb(var(--reg-muted)/0.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.45)] focus-visible:ring-offset-0";

/** booqi-web's offer pink (guava-500/700), for previews of what clients see. */
export const GUAVA = { badge: "bg-[#ff5e7e] text-[rgb(var(--reg-ink))]", text: "text-[#c4294f]" };

export function salonName(): string {
  try {
    return (JSON.parse(localStorage.getItem("currentBusiness") || "{}") ?? {}).name || t("common.yourSalon");
  } catch {
    return t("common.yourSalon");
  }
}

/** "45 ₼", "12.50 ₼" — drops the decimals when there are none (prices on cards and previews). */
export function money(amount: number | string | null | undefined, symbol: string): string {
  const n = Number(amount ?? 0);
  const v = Number.isFinite(n) ? n : 0;
  return `${Number.isInteger(v) ? v : v.toFixed(2)} ${symbol}`;
}
