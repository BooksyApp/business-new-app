import { useEffect, useMemo, useState } from "react";
import { useLocation } from "react-router-dom";
import { Search } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { useVisibleSettings } from "@/components/layout/navigation";
import { NavCard, NavCardGrid } from "@/components/layout/NavCards";
import { BooqiScope, PageHeader } from "@/components/page/booqi";
import { pageBody } from "@/components/page/booqiStyles";
import { fieldCls } from "@/components/page/kitStyles";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/utils/navigationUtils";
import { t } from "@/i18n";

/**
 * The settings hub: every setting once, as cards under each group (v3 — the same card page
 * every category has). The map lives in components/layout/navigation.ts (SETTINGS_SECTIONS)
 * so this page, the "Settings › Page" trail and the quick search can never disagree.
 */
export default function SetupPage() {
  const location = useLocation();
  const { getPath } = useNavigation();
  const [query, setQuery] = useState("");
  const all = useVisibleSettings();

  const focusedCategory = useMemo(() => new URLSearchParams(location.search).get("focus"), [location.search]);

  // ?focus=business (from onboarding) scrolls that section into view and marks it.
  useEffect(() => {
    if (!focusedCategory) return;
    document.getElementById(`setup-${focusedCategory}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
  }, [focusedCategory]);

  const q = query.trim().toLowerCase();
  const sections = all
    .map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      icon: s.icon,
      rows: q ? s.rows.filter((r) => `${s.title} ${r.label} ${r.hint}`.toLowerCase().includes(q)) : s.rows,
    }))
    .filter((s) => s.rows.length);

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader helpSlug="ilk-addimlar" title={t("setup.settings")} subtitle={t("nav.set.subtitle")} />

        <div className={pageBody}>
          <div className="relative mb-6 max-w-md">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[rgb(var(--reg-muted))]" aria-hidden />
            <input aria-label={t("setup.searchSettings")} className={cn(fieldCls, "h-11 pl-10")} placeholder={t("setup.searchSettings")} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          {sections.length === 0 && (
            <p className="rounded-[20px] bg-white px-5 py-10 text-center text-sm text-[rgb(var(--reg-muted))] ring-1 shadow-[var(--shadow-sm)] ring-[rgb(var(--reg-line)/0.6)]">{t("setup.noSettingMatches", { query })}</p>
          )}

          <div className="space-y-8">
            {sections.map((s) => (
              <section
                key={s.id}
                id={`setup-${s.id}`}
                aria-labelledby={`setup-${s.id}-title`}
                className={cn("scroll-mt-[140px] rounded-[24px]", focusedCategory === s.id && "outline outline-2 outline-offset-8 outline-[rgb(var(--reg-brand)/0.45)]")}
              >
                <header className="mb-3 flex items-baseline gap-3">
                  <h2 id={`setup-${s.id}-title`} className="text-[17px] font-extrabold tracking-[-0.01em]">{s.title}</h2>
                  <p className="hidden truncate text-sm text-[rgb(var(--reg-muted))] sm:block">{s.description}</p>
                </header>
                <NavCardGrid>
                  {s.rows.map((r) => (
                    <NavCard key={r.path} to={getPath(r.path)} icon={r.icon} title={r.label} description={r.hint} />
                  ))}
                </NavCardGrid>
              </section>
            ))}
          </div>
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
