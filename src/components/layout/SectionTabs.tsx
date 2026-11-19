import { NavLink } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { BRAND_FONT } from "@/components/auth/useBrandFont";
import { useVisibleNav, useVisibleSettings } from "./navigation";

/**
 * Tabs across the top of a page family (Team: Members · Timesheet · Payroll · Targets) and
 * of a settings group (Business: Profile · Photos · Hours · Branding). The rail keeps one
 * link per family, so it fits a laptop screen; the sibling pages are one click away here.
 * Each tab is still its own address, so old links and bookmarks keep working.
 */
export function SectionTabs({ base, current }: { base: string; current: string }) {
  const sections = useVisibleNav();
  const settings = useVisibleSettings();

  const family = sections.flatMap((s) => s.entries).find((e) => e.tabs?.some((x) => x.path === current));
  const group = family ? undefined : settings.find((s) => s.rows.some((r) => r.path === current));
  const tabs = family?.tabs ?? group?.rows ?? [];
  const inSettings = Boolean(group);
  if (tabs.length < 2 && !inSettings) return null;

  return (
    <div
      style={{ fontFamily: BRAND_FONT }}
      className={cn(
        "shrink-0 border-b border-[rgb(var(--reg-line)/0.8)] bg-[rgb(var(--reg-canvas))] px-2 text-[rgb(var(--reg-ink))] md:px-6",
        // A one-page settings group needs only the phone's way back to the settings map.
        tabs.length < 2 && "lg:hidden",
      )}
    >
      <div className="flex items-center overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {inSettings && (
          <NavLink
            to={`${base}/setup`}
            className="mr-1 flex h-11 shrink-0 items-center gap-0.5 rounded-lg px-2 text-[13px] font-semibold text-[rgb(var(--reg-muted))] hover:text-[rgb(var(--reg-ink))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)] lg:hidden"
          >
            <ChevronLeft size={16} aria-hidden />
            {t("nav.settings")}
          </NavLink>
        )}
        {tabs.length > 1 && (
          <nav aria-label={family ? family.label : group?.title ?? t("nav.pageTabs")} className="flex items-center gap-0.5">
            {tabs.map((x) => {
              const on = x.path === current;
              return (
                <NavLink
                  key={x.path}
                  to={`${base}${x.path}`}
                  aria-current={on ? "page" : undefined}
                  className={cn(
                    "relative flex h-11 shrink-0 items-center whitespace-nowrap rounded-lg px-3 text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[rgb(var(--reg-brand)/0.5)]",
                    on
                      ? "text-[rgb(var(--reg-brand-strong))] after:absolute after:inset-x-3 after:bottom-0 after:h-[2px] after:rounded-full after:bg-[rgb(var(--reg-brand))]"
                      : "text-[rgb(var(--reg-ink)/0.6)] hover:text-[rgb(var(--reg-ink))]",
                  )}
                >
                  {x.label}
                </NavLink>
              );
            })}
          </nav>
        )}
      </div>
    </div>
  );
}
