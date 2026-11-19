import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import { BRAND_FONT } from "@/components/auth/useBrandFont";
import { SettingsIcon, useVisibleSettings } from "./navigation";

/**
 * Settings' own left sub-nav, beside every settings screen on a desktop.
 *
 * Settings used to be a page of links that each led somewhere with no way sideways: to go
 * from Opening hours to Payment methods meant back, scroll, click. Now the whole settings
 * map stays in view while you work in one of them. On a phone the hub page is the map.
 */
export function SettingsNav({ base, current }: { base: string; current: string }) {
  const sections = useVisibleSettings();
  const href = (path: string) => `${base}${path}`;
  const link = (on: boolean) =>
    cn(
      "flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.5)]",
      on
        ? "bg-[rgb(var(--reg-brand)/0.1)] font-semibold text-[rgb(var(--reg-brand-strong))]"
        : "text-[rgb(var(--reg-ink)/0.72)] hover:bg-[rgb(var(--reg-ink)/0.04)] hover:text-[rgb(var(--reg-ink))]",
    );
  return (
    <nav
      aria-label={t("setup.settingsSections")}
      style={{ fontFamily: BRAND_FONT }}
      className="hidden w-[232px] shrink-0 flex-col overflow-y-auto border-r border-[rgb(var(--reg-line)/0.8)] bg-[rgb(var(--reg-canvas))] px-3 pb-6 pt-5 text-[rgb(var(--reg-ink))] lg:flex"
    >
      <NavLink to={href("/setup")} end aria-current={current === "/setup" ? "page" : undefined} className={cn(link(current === "/setup"), "mb-3 text-[14px] font-bold")}>
        <SettingsIcon size={16} strokeWidth={1.9} aria-hidden />
        {t("nav.set.allSettings")}
      </NavLink>
      {sections.map((s) => (
        <div key={s.id} className="mb-4">
          <p className="px-2.5 pb-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[rgb(var(--reg-muted)/0.85)]">{s.title}</p>
          <ul className="space-y-0.5">
            {s.rows.map((r) => {
              const on = current === r.path;
              return (
                <li key={r.path}>
                  <NavLink to={href(r.path)} aria-current={on ? "page" : undefined} className={link(on)}>
                    <span className="truncate">{r.label}</span>
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
