import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { FLAG_DEFS, flagDef, type FlagKey } from "@/lib/appointmentFlags";

/**
 * The small line icons of a calendar block. `bare` emits only the frame's `<i class="ni">` items
 * (BF02 `.nb > i.ni > svg.ic`, overflow as `<i class="nx">+N`) so a block can put them in its own `.nb`.
 */
export function FlagIcons({ keys, max = 4, size = 13, className, bare }: { keys: FlagKey[]; max?: number; size?: number; className?: string; bare?: boolean }) {
  if (keys.length === 0) return null;
  const shown = keys.slice(0, max);
  const rest = keys.slice(max);
  const items = (
    <>
      {shown.map((k) => {
        const d = flagDef(k);
        const label = d.label();
        return (
          <i key={k} role="img" aria-label={label} title={label} className={cn("ni", d.tone === "guava" && "lt")}>
            <d.Icon className="ic" size={size} strokeWidth={2} aria-hidden />
          </i>
        );
      })}
      {rest.length > 0 && (
        <i className="nx" title={rest.map((k) => flagDef(k).label()).join(" · ")}>
          +{rest.length}
        </i>
      )}
    </>
  );
  if (bare) return items;
  return (
    <span className={cn("nb", className)}>
      {items}
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
          className="chip"
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
