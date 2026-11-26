import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FLAG_DEFS, flagDef, type FlagKey } from "@/lib/appointmentFlags";

/** A compact row of small line icons; each has its own tooltip (title) and aria-label. */
export function FlagIcons({ keys, max = 4, size = 13, className }: { keys: FlagKey[]; max?: number; size?: number; className?: string }) {
  if (keys.length === 0) return null;
  const shown = keys.slice(0, max);
  const rest = keys.slice(max);
  return (
    <span className={cn("inline-flex shrink-0 items-center gap-[3px]", className)}>
      {shown.map((k) => {
        const d = flagDef(k);
        const label = d.label();
        return (
          <span
            key={k}
            role="img"
            aria-label={label}
            title={label}
            className={cn("inline-flex", d.tone === "guava" ? "text-[#e83e63]" : "opacity-70")}
          >
            <d.Icon size={size} strokeWidth={2} aria-hidden />
          </span>
        );
      })}
      {rest.length > 0 && (
        <span title={rest.map((k) => flagDef(k).label()).join(" · ")} className="text-[10px] font-bold leading-none opacity-70">
          +{rest.length}
        </span>
      )}
    </span>
  );
}

/** "Nişanlar": what every small icon on a booking means. Lives in the calendar toolbar. */
export function FlagLegend() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-3.5 text-sm font-semibold text-[rgb(var(--reg-muted))] ring-1 ring-[rgb(var(--reg-line))] transition-colors hover:ring-[rgb(var(--reg-brand)/0.4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand))]"
        >
          <Info size={16} strokeWidth={1.75} aria-hidden />
          <span className="hidden sm:inline">{t("calendar.legendTitle")}</span>
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <p className="px-1 pb-2 text-xs font-bold uppercase tracking-[0.08em] text-[rgb(var(--reg-muted))]">{t("calendar.legendTitle")}</p>
        <ul className="space-y-0.5">
          {FLAG_DEFS.map((d) => (
            <li key={d.key} className="flex items-center gap-3 rounded-lg px-1 py-1.5 text-sm">
              <span className={cn("inline-flex h-6 w-6 items-center justify-center rounded-full bg-[rgb(var(--reg-canvas))]", d.tone === "guava" ? "text-[#e83e63]" : "text-[rgb(var(--reg-ink)/0.75)]")}>
                <d.Icon size={14} strokeWidth={2} aria-hidden />
              </span>
              <span className="font-medium">{d.label()}</span>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}

/** The two row densities of the calendar, stored per browser. */
export type CalendarDensity = "comfy" | "compact";
