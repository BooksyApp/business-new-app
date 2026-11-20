import { Link } from "react-router-dom";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { cn } from "@/lib/utils";
import { formatDate, formatNumber } from "@/i18n/format";
import { getLocale, t, type TKey } from "@/i18n";
import { RANGES, fmtBy, fmtDay, fmtInt, fmtPct, type RangeKey, type Unit } from "./reportsFormat";
import "./reports.css";

const loc = () => getLocale();

export function PeriodPicker({ value, onChange, ranges = RANGES }: { value: RangeKey; onChange: (r: RangeKey) => void; ranges?: readonly RangeKey[] }) {
  return (
    <div
      role="radiogroup"
      aria-label={t("reports.period")}
      className="flex max-w-[calc(100vw-2rem)] gap-1 overflow-x-auto rounded-full bg-white p-1 ring-1 ring-[rgb(var(--reg-line)/0.8)] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {ranges.map((r) => {
        const on = r === value;
        return (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(r)}
            className={cn(
              "h-8 shrink-0 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]",
              on ? "bg-[rgb(var(--reg-ink))] text-white" : "text-[rgb(var(--reg-ink)/0.65)] hover:text-[rgb(var(--reg-ink))]",
            )}
          >
            {t(`reports.range.${r}` as TKey)}
          </button>
        );
      })}
    </div>
  );
}

/* ── change vs the previous period ──────────────────────────────────────── */

/**
 * The change badge. Rates change in percentage points (a no-show rate going 4% → 6% is
 * "+2 pp", not "+50%"); amounts in percent. `goodWhen` says which direction is good news,
 * so colour means good/bad, and the arrow and words carry it without colour.
 */
export function Delta({ value, previous, unit, goodWhen = "up", className }: { value: number; previous: number; unit: Unit; goodWhen?: "up" | "down"; className?: string }) {
  const diff = unit === "pct" ? value - previous : previous === 0 ? (value === 0 ? 0 : null) : ((value - previous) / Math.abs(previous)) * 100;
  if (diff === null) {
    return <span className={cn("text-[12.5px] font-semibold text-[rgb(var(--reg-muted))]", className)}>{t("reports.new")}</span>;
  }
  const flat = Math.abs(diff) < 0.05;
  const up = diff > 0;
  const good = flat ? null : (up ? goodWhen === "up" : goodWhen === "down");
  const Icon = flat ? Minus : up ? ArrowUpRight : ArrowDownRight;
  const amount = `${up ? "+" : flat ? "" : "−"}${formatNumber(loc(), Math.abs(diff), { maximumFractionDigits: 1 })}${unit === "pct" ? ` ${t("reports.pp")}` : "%"}`;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[12.5px] font-bold tabular-nums",
        good === null && "bg-[rgb(var(--reg-ink)/0.05)] text-[rgb(var(--reg-ink)/0.65)]",
        good === true && "bg-[rgb(var(--rp-good-soft))] text-[rgb(var(--rp-good))]",
        good === false && "bg-[rgb(var(--rp-bad-soft))] text-[rgb(var(--rp-bad))]",
        className,
      )}
    >
      <Icon size={14} strokeWidth={2.4} aria-hidden />
      {amount}
      <span className="sr-only">{good === true ? t("reports.better") : good === false ? t("reports.worse") : ""}</span>
    </span>
  );
}

/* ── tiles and panels ───────────────────────────────────────────────────── */

export function KpiTile({
  to,
  label,
  value,
  previous,
  unit,
  goodWhen,
  foot,
}: {
  to: string;
  label: string;
  value: number;
  previous: number;
  unit: Unit;
  goodWhen?: "up" | "down";
  foot?: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className="group flex min-h-[132px] flex-col rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] transition-shadow hover:shadow-[0_10px_30px_-18px_rgb(var(--reg-ink)/0.35)] hover:ring-[rgb(var(--reg-brand)/0.35)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.6)] md:p-5"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold text-[rgb(var(--reg-muted))]">{label}</p>
        <ArrowRight size={16} aria-hidden className="text-[rgb(var(--reg-ink)/0.2)] transition-transform group-hover:translate-x-0.5 group-hover:text-[rgb(var(--reg-brand))] motion-reduce:transition-none" />
      </div>
      <p className="mt-2 text-[26px] font-extrabold leading-none tracking-[-0.03em] tabular-nums md:text-[28px]">{fmtBy(unit, value)}</p>
      <div className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-3">
        <Delta value={value} previous={previous} unit={unit} goodWhen={goodWhen} />
        {foot ?? <span className="text-[12px] text-[rgb(var(--reg-muted))]">{t("reports.wasValue", { value: fmtBy(unit, previous) })}</span>}
      </div>
    </Link>
  );
}

export function Panel({ title, hint, action, children, className }: { title: string; hint?: string; action?: React.ReactNode; children: React.ReactNode; className?: string }) {
  return (
    <section className={cn("min-w-0 rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-6", className)}>
      <header className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h2 className="text-[16px] font-extrabold tracking-[-0.01em]">{title}</h2>
          {hint && <p className="mt-0.5 text-[13px] text-[rgb(var(--reg-muted))]">{hint}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function PanelLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="inline-flex items-center gap-1 rounded-md text-[13px] font-semibold text-[rgb(var(--reg-brand-strong))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]">
      {children}
      <ArrowRight size={14} aria-hidden />
    </Link>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="rounded-2xl bg-[rgb(var(--reg-canvas))] px-4 py-8 text-center text-sm text-[rgb(var(--reg-muted))]">{children}</p>;
}

/* ── charts ─────────────────────────────────────────────────────────────── */

type TrendPoint = { date: string; value: number; previous: number | null };

/** The period as a violet area, the period before it as a dashed grey line; one y-axis. */
export function TrendChart({ data, unit, height = 260 }: { data: TrendPoint[]; unit: Unit; height?: number }) {
  const showPrev = data.some((d) => d.previous !== null && d.previous !== 0);
  const ticks = data.length > 1 ? [data[0].date, data[Math.floor((data.length - 1) / 2)].date, data[data.length - 1].date] : undefined;
  return (
    <div>
      <div className="mb-3 flex items-center gap-4 text-[12.5px] text-[rgb(var(--reg-muted))]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-[3px] w-4 rounded-full bg-[rgb(var(--rp-accent))]" aria-hidden />
          {t("reports.thisPeriod")}
        </span>
        {showPrev && (
          <span className="inline-flex items-center gap-1.5">
            <span className="w-4 border-t-2 border-dashed border-[rgb(var(--rp-prev))]" aria-hidden />
            {t("reports.previousPeriod")}
          </span>
        )}
      </div>
      <div style={{ height }} role="img" aria-label={t("reports.trendAria")}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <defs>
              <linearGradient id="rp-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--rp-accent))" stopOpacity={0.18} />
                <stop offset="100%" stopColor="rgb(var(--rp-accent))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="rgb(var(--rp-grid))" />
            <XAxis
              dataKey="date"
              ticks={ticks}
              tickFormatter={(d: string) => fmtDay(d)}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "rgb(var(--reg-muted))" }}
              interval="preserveStartEnd"
            />
            <YAxis
              width={56}
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 12, fill: "rgb(var(--reg-muted))" }}
              tickFormatter={(v: number) => (unit === "money" ? formatNumber(loc(), v, { notation: "compact" }) : fmtBy(unit, v))}
              allowDecimals={unit !== "int"}
            />
            <Tooltip
              cursor={{ stroke: "rgb(var(--reg-ink) / 0.25)", strokeWidth: 1 }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as TrendPoint;
                return (
                  <div className="rounded-xl bg-[rgb(var(--reg-ink))] px-3 py-2 text-[12.5px] text-white shadow-lg">
                    <p className="font-semibold">{fmtDay(p.date, { weekday: "short", day: "numeric", month: "short" })}</p>
                    <p className="tabular-nums">{fmtBy(unit, p.value)}</p>
                    {showPrev && p.previous !== null && <p className="tabular-nums text-white/65">{t("reports.before", { value: fmtBy(unit, p.previous) })}</p>}
                  </div>
                );
              }}
            />
            {showPrev && (
              <Line type="monotone" dataKey="previous" stroke="rgb(var(--rp-prev))" strokeWidth={1.5} strokeDasharray="4 4" dot={false} activeDot={false} isAnimationActive={false} />
            )}
            <Area
              type="monotone"
              dataKey="value"
              stroke="rgb(var(--rp-accent))"
              strokeWidth={2}
              fill="url(#rp-fill)"
              dot={false}
              activeDot={{ r: 4, strokeWidth: 2, stroke: "rgb(var(--rp-surface))", fill: "rgb(var(--rp-accent))" }}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

/** Ranked rows: name, value, and a bar from a shared zero. */
export function BarRows({ rows, unit, max }: { rows: { label: string; value: number; sub?: string }[]; unit: Unit; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 text-[14px]">
            <span className="min-w-0 truncate font-semibold">{r.label}</span>
            <span className="shrink-0 tabular-nums text-[rgb(var(--reg-ink)/0.8)]">
              {fmtBy(unit, r.value)}
              {r.sub && <span className="ml-1.5 text-[12.5px] text-[rgb(var(--reg-muted))]">{r.sub}</span>}
            </span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-[rgb(var(--rp-track))]" aria-hidden>
            <div className="h-2 rounded-full bg-[rgb(var(--rp-accent))]" style={{ width: `${Math.max(r.value > 0 ? 2 : 0, (r.value / top) * 100)}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Five steps of the one violet: 0 is empty, 4 is the busiest. */
const STEP_ALPHA = [0, 0.18, 0.38, 0.62, 0.9];
const step = (v: number, max: number) => (v <= 0 || max <= 0 ? 0 : Math.min(4, Math.ceil((v / max) * 4)));

export function Heatmap({ cells }: { cells: { dow: number; hour: number; bookings: number }[] }) {
  const hours = cells.length ? cells.map((c) => c.hour) : [9, 20];
  const from = Math.min(9, ...hours);
  const to = Math.max(20, ...hours);
  const span = Array.from({ length: to - from + 1 }, (_, i) => from + i);
  const max = Math.max(0, ...cells.map((c) => c.bookings));
  const at = (d: number, h: number) => cells.find((c) => c.dow === d && c.hour === h)?.bookings ?? 0;
  const dayName = (d: number) => formatDate(loc(), new Date(2024, 0, d), { weekday: "short" }); // 2024-01-01 is a Monday
  return (
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-[520px] border-separate border-spacing-[3px] text-[11.5px]">
        <caption className="sr-only">{t("reports.heatmapCaption")}</caption>
        <thead>
          <tr>
            <th className="w-10" />
            {span.map((h) => (
              <th key={h} scope="col" className="pb-1 text-center font-medium text-[rgb(var(--reg-muted))]">
                {h % 2 === 0 ? `${h}` : <span className="sr-only">{h}</span>}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <tr key={d}>
              <th scope="row" className="pr-1 text-left font-semibold text-[rgb(var(--reg-ink)/0.7)]">{dayName(d)}</th>
              {span.map((h) => {
                const v = at(d, h);
                const s = step(v, max);
                return (
                  <td
                    key={h}
                    title={t("reports.heatCell", { day: dayName(d), hour: `${h}:00`, count: v })}
                    className="h-7 rounded-[6px] text-center tabular-nums"
                    style={{
                      background: s ? `rgb(var(--rp-accent) / ${STEP_ALPHA[s]})` : "rgb(var(--rp-grid) / 0.55)",
                      color: s >= 3 ? "white" : "transparent",
                    }}
                  >
                    <span className={s >= 3 ? "" : "sr-only"}>{v}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-3 flex items-center justify-end gap-1.5 text-[12px] text-[rgb(var(--reg-muted))]" aria-hidden>
        {t("reports.fewer")}
        {STEP_ALPHA.map((a, i) => (
          <span key={i} className="h-3 w-4 rounded-[4px]" style={{ background: a ? `rgb(var(--rp-accent) / ${a})` : "rgb(var(--rp-grid) / 0.55)" }} />
        ))}
        {t("reports.more")}
      </div>
    </div>
  );
}

export function CohortTable({ cohorts }: { cohorts: { month: string; clients: number; retained: number[] }[] }) {
  const cols = Math.max(0, ...cohorts.map((c) => c.retained.length));
  const monthLabel = (m: string) => formatDate(loc(), `${m}-15T12:00:00`, { month: "short", year: "numeric" });
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[460px] border-separate border-spacing-[3px] text-[13px]">
        <caption className="sr-only">{t("reports.cohortCaption")}</caption>
        <thead>
          <tr className="text-[12px] text-[rgb(var(--reg-muted))]">
            <th scope="col" className="pb-1 text-left font-medium">{t("reports.firstVisit")}</th>
            <th scope="col" className="pb-1 text-right font-medium">{t("reports.newClientsShort")}</th>
            {Array.from({ length: cols }, (_, i) => (
              <th key={i} scope="col" className="pb-1 text-center font-medium">{t("reports.monthN", { n: i + 1 })}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cohorts.map((c) => (
            <tr key={c.month}>
              <th scope="row" className="whitespace-nowrap pr-2 text-left font-semibold">{monthLabel(c.month)}</th>
              <td className="pr-2 text-right tabular-nums text-[rgb(var(--reg-ink)/0.75)]">{fmtInt(c.clients)}</td>
              {Array.from({ length: cols }, (_, i) => {
                const v = c.retained[i];
                if (v === undefined) return <td key={i} />;
                const s = c.clients ? step(v, 60) : 0;
                return (
                  <td
                    key={i}
                    className="h-8 min-w-[52px] rounded-[6px] text-center font-semibold tabular-nums"
                    style={{
                      background: s ? `rgb(var(--rp-accent) / ${STEP_ALPHA[s]})` : "rgb(var(--rp-grid) / 0.55)",
                      color: s >= 3 ? "white" : "rgb(var(--reg-ink) / 0.75)",
                    }}
                  >
                    {c.clients ? fmtPct(v) : "–"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
