import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { BRAND_FONT } from "@/components/auth/useBrandFont";
import { SettingsIcon, useVisibleSettings } from "./navigation";

/**
 * Settings' own left sub-nav, beside every settings screen on a desktop: the seven groups,
 * nothing deeper. A group opens its first page; its other pages are tabs on top
 * (SectionTabs). On a phone the hub page is the map.
 */
export function SettingsNav({ base, current }: { base: string; current: string }) {
  const sections = useVisibleSettings();
  const link = (on: boolean) =>
    cn(
      "group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13.5px] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]",
      on
        ? "bg-[rgb(var(--reg-brand)/0.1)] text-[rgb(var(--reg-brand-strong))]"
        : "text-[rgb(var(--reg-ink)/0.72)] hover:bg-[rgb(var(--reg-ink)/0.04)] hover:text-[rgb(var(--reg-ink))]",
    );
  const icon = (on: boolean) => cn("shrink-0", on ? "text-[rgb(var(--reg-brand))]" : "text-[rgb(var(--reg-ink)/0.5)] group-hover:text-[rgb(var(--reg-ink)/0.75)]");
  const hubOn = current === "/setup";
  return (
    <nav
      aria-label={t("setup.settingsSections")}
      style={{ fontFamily: BRAND_FONT }}
      className="hidden w-[220px] shrink-0 flex-col overflow-y-auto border-r border-[rgb(var(--reg-line)/0.8)] bg-[rgb(var(--reg-canvas))] px-3 pb-6 pt-4 text-[rgb(var(--reg-ink))] lg:flex"
    >
      <p className="px-2.5 pb-2 text-[10.5px] font-bold uppercase tracking-[0.09em] text-[rgb(var(--reg-muted)/0.85)]">{t("nav.settings")}</p>
      <ul className="space-y-px">
        <li>
          <NavLink to={`${base}/setup`} end aria-current={hubOn ? "page" : undefined} className={link(hubOn)}>
            <SettingsIcon size={18} strokeWidth={1.75} className={icon(hubOn)} aria-hidden />
            {t("nav.set.allSettings")}
          </NavLink>
        </li>
        {sections.map((s) => {
          const on = s.rows.some((r) => r.path === current);
          const Icon = s.icon;
          return (
            <li key={s.id}>
              <NavLink to={`${base}${s.rows[0].path}`} aria-current={on ? "page" : undefined} className={link(on)}>
                <Icon size={18} strokeWidth={1.75} className={icon(on)} aria-hidden />
                <span className="truncate">{s.title}</span>
              </NavLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
