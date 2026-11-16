import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type Tone = "violet" | "emerald" | "amber" | "sky" | "rose" | "slate";

const TONES: Record<Tone, { ring: string; icon: string; value: string }> = {
  violet: { ring: "bg-violet-50", icon: "text-violet-600", value: "text-violet-700" },
  emerald: { ring: "bg-[rgb(var(--reg-brand-soft))]", icon: "text-[rgb(var(--reg-brand))]", value: "text-[rgb(var(--reg-ink))]" },
  amber: { ring: "bg-amber-50", icon: "text-amber-600", value: "text-amber-700" },
  sky: { ring: "bg-sky-50", icon: "text-sky-600", value: "text-sky-700" },
  rose: { ring: "bg-rose-50", icon: "text-rose-600", value: "text-rose-700" },
  slate: { ring: "bg-slate-100", icon: "text-slate-600", value: "text-slate-700" },
};

/**
 * One number, said loudly.
 *
 * Every page opened as a wall of same-sized text, so the figure that actually answers
 * "how are we doing" sat at the same weight as a table header. A row of these puts the
 * answer above the detail, and colour makes each one findable without reading it.
 */
export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "violet",
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone?: Tone;
  className?: string;
}) {
  const t = TONES[tone];
  return (
    <div className={cn("rounded-xl border bg-white p-4", className)}>
      <div className="flex items-center gap-3">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", t.ring)}>
          <Icon size={18} className={t.icon} />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={cn("text-xl font-semibold leading-tight", t.value)}>{value}</p>
        </div>
      </div>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * What to show when there is nothing.
 *
 * "No data" in grey 12px tells someone their page is broken. This says what would be here
 * and what to do about it.
 */
export function EmptyState({
  icon: Icon,
  title,
  body,
  action,
}: {
  icon: LucideIcon;
  title: string;
  body?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-white px-6 py-14 text-center">
      <span className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-violet-50">
        <Icon size={22} className="text-violet-600" />
      </span>
      <p className="font-medium">{title}</p>
      {body && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{body}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
