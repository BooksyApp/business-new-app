import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/page/booqi";
import { cn } from "@/lib/utils";
import { Lightbulb, type LucideIcon } from "lucide-react";
import { t as tr } from "@/i18n";

export type Tone = "violet" | "sky" | "emerald" | "amber" | "rose" | "slate";

const TONE: Record<Tone, { chip: string; value: string; bar: string; edge: string }> = {
  violet: { chip: "bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand))]", value: "text-[rgb(var(--reg-ink))]", bar: "bg-[linear-gradient(90deg,rgb(var(--reg-brand)),rgb(var(--reg-mesh-2)))]", edge: "" },
  sky: { chip: "bg-sky-50 text-sky-600", value: "text-[rgb(var(--reg-ink))]", bar: "bg-sky-500", edge: "border-l-sky-500" },
  emerald: { chip: "bg-emerald-50 text-emerald-600", value: "text-[rgb(var(--reg-ink))]", bar: "bg-emerald-500", edge: "border-l-emerald-500" },
  amber: { chip: "bg-amber-50 text-amber-600", value: "text-[rgb(var(--reg-ink))]", bar: "bg-amber-500", edge: "border-l-amber-500" },
  rose: { chip: "bg-rose-50 text-rose-600", value: "text-[rgb(var(--reg-ink))]", bar: "bg-rose-500", edge: "border-l-rose-500" },
  slate: { chip: "bg-slate-100 text-slate-600", value: "text-[rgb(var(--reg-ink))]", bar: "bg-slate-400", edge: "border-l-slate-400" },
};

/** One figure, coloured by what it means rather than by the brand. */
export function Metric({
  icon: Icon,
  label,
  value,
  hint,
  tone = "violet",
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
}) {
  const t = TONE[tone];
  return (
    <Card>
      <CardContent className="p-4 md:p-5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-[rgb(var(--reg-muted))]">{label}</p>
          <span className={cn("flex h-9 w-9 items-center justify-center rounded-xl", t.chip)}>
            <Icon size={16} />
          </span>
        </div>
        <p className={cn("mt-2 text-[28px] font-extrabold leading-none tracking-[-0.03em] tabular-nums", t.value)}>{value}</p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

/**
 * A ranked list with the share drawn.
 *
 * Every one of these tabs was a bare two-column table: a date and a count, sorted by
 * date. A table of numbers makes you do the comparing; a bar does it for you.
 */
export function BarList({
  title,
  description,
  rows,
  tone = "violet",
  emptyText = tr("analytics.nothingInThisPeriod"),
  formatValue,
}: {
  title: string;
  description?: string;
  rows: { label: string; value: number; detail?: string }[];
  tone?: Tone;
  emptyText?: string;
  formatValue?: (value: number) => string;
}) {
  const max = rows.length ? Math.max(...rows.map((r) => r.value)) : 0;
  const t = TONE[tone];
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">{title}</CardTitle>
        {description && <CardDescription className="mt-0.5">{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-2.5">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          rows.map((row) => (
            <div key={row.label}>
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="min-w-0 truncate">{row.label}</span>
                <span className="shrink-0 font-semibold">
                  {formatValue ? formatValue(row.value) : row.value}
                </span>
              </div>
              <div className="mt-1 flex items-center gap-2">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgb(var(--reg-ink)/0.06)]">
                  <div
                    className={cn("h-full rounded-full", t.bar)}
                    style={{ width: `${max > 0 ? (row.value / max) * 100 : 0}%` }}
                  />
                </div>
                {row.detail && (
                  <span className="w-28 shrink-0 text-right text-xs text-muted-foreground">{row.detail}</span>
                )}
              </div>
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
}

/** What the numbers add up to, in sentences. A salon owner is not a chart reader. */
export function Insights({ items }: { items: { text: string; tone?: Tone }[] }) {
  if (items.length === 0) return null;
  return (
    <div className="rounded-[20px] bg-[rgb(var(--reg-brand-soft))] p-4 ring-1 ring-[rgb(var(--reg-brand)/0.2)] md:p-5">
      <div className="mb-2 flex items-center gap-2">
        <Lightbulb size={16} className="text-[rgb(var(--reg-brand))]" />
        <p className="text-sm font-semibold text-[rgb(var(--reg-ink))]">{tr("analytics.whatThisIsTellingYou")}</p>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-2 text-sm text-[rgb(var(--reg-ink)/0.8)]">
            <span className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", TONE[item.tone ?? "violet"].bar)} />
            {item.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
