import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ChevronRight, Search } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { useVisibleSettings } from "@/components/layout/navigation";
import { BooqiScope, PageHeader } from "@/components/page/booqi";
import { pageBody } from "@/components/page/booqiStyles";
import { fieldCls } from "@/components/page/kitStyles";
import { cn } from "@/lib/utils";
import { useNavigation } from "@/utils/navigationUtils";
import { t } from "@/i18n";

/**
 * The settings hub: every setting once, in grouped cards. The map itself lives in
 * components/layout/navigation.ts (SETTINGS_SECTIONS) so this page, the settings sub-nav
 * beside every settings screen and the quick search can never disagree.
 */
export default function SetupPage() {
  const location = useLocation();
  const navigate = useNavigate();
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
        <PageHeader title={t("setup.settings")} subtitle={t("nav.set.subtitle")} />

        <div className={pageBody}>
          <div className="relative mb-6 max-w-md">
            <Search size={16} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[rgb(var(--reg-muted))]" aria-hidden />
            <input aria-label={t("setup.searchSettings")} className={cn(fieldCls, "h-11 pl-10")} placeholder={t("setup.searchSettings")} value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>

          {sections.length === 0 && (
            <p className="rounded-[20px] bg-white px-5 py-10 text-center text-sm text-[rgb(var(--reg-muted))] ring-1 ring-[rgb(var(--reg-line)/0.8)]">{t("setup.noSettingMatches", { query })}</p>
          )}

          <div className="grid items-start gap-4 xl:grid-cols-2">
            {sections.map((s) => {
              const Icon = s.icon;
              return (
                <section
                  key={s.id}
                  id={`setup-${s.id}`}
                  aria-labelledby={`setup-${s.id}-title`}
                  className={cn("scroll-mt-[140px] overflow-hidden rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]", focusedCategory === s.id && "ring-2 ring-[rgb(var(--reg-brand)/0.6)]")}
                >
                  <header className="flex items-center gap-3 px-4 pb-3 pt-4 md:px-5">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgb(var(--reg-brand-soft))] text-[rgb(var(--reg-brand-strong))]">
                      <Icon size={18} strokeWidth={1.9} />
                    </span>
                    <div className="min-w-0">
                      <h2 id={`setup-${s.id}-title`} className="text-base font-extrabold tracking-[-0.01em]">{s.title}</h2>
                      <p className="text-sm text-[rgb(var(--reg-muted))]">{s.description}</p>
                    </div>
                  </header>
                  <ul>
                    {s.rows.map((r) => {
                      const RowIcon = r.icon;
                      return (
                        <li key={r.path} className="border-t border-[rgb(var(--reg-line)/0.6)]">
                          <button
                            type="button"
                            onClick={() => navigate(getPath(r.path))}
                            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[rgb(var(--reg-canvas)/0.7)] focus-visible:bg-[rgb(var(--reg-canvas))] focus-visible:outline-none md:px-5"
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center text-[rgb(var(--reg-ink)/0.5)]">
                              <RowIcon size={18} strokeWidth={1.75} aria-hidden />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block text-[15px] font-semibold">{r.label}</span>
                              <span className="block text-sm text-[rgb(var(--reg-muted))]">{r.hint}</span>
                            </span>
                            <ChevronRight size={18} className="shrink-0 text-[rgb(var(--reg-ink)/0.35)]" aria-hidden />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        </div>
      </BooqiScope>
    </AppLayout>
  );
}
