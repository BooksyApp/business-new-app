import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { ChevronRight, Search } from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { useVisibleSettings } from "@/components/layout/navigation";
import { Card, Field, FormGrid, PageHead } from "@/components/bz";
import { BzPage, HelpLink } from "@/components/bz/p3-Settings";
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
      <BzPage>
        <PageHead title={t("setup.settings")} sub={t("nav.set.subtitle")} right={<HelpLink slug="ilk-addimlar" />} />

        <div style={{ maxWidth: 420, marginBottom: 16 }}>
          <Field label={t("setup.searchSettings")} suffix={<Search size={16} aria-hidden />}>
            <input aria-label={t("setup.searchSettings")} placeholder={t("setup.searchSettings")} value={query} onChange={(e) => setQuery(e.target.value)} />
          </Field>
        </div>

        {sections.length === 0 && (
          <Card>
            <p style={{ textAlign: "center", color: "var(--bz-muted)", padding: "24px 0" }}>{t("setup.noSettingMatches", { query })}</p>
          </Card>
        )}

        <FormGrid cols={3}>
          {sections.map((s) => (
            <section key={s.id} id={`setup-${s.id}`} aria-labelledby={`setup-${s.id}-title`} style={{ scrollMarginTop: 140, ...(focusedCategory === s.id ? { outline: "2px solid var(--bz-violet)", outlineOffset: 6, borderRadius: 22 } : null) }}>
              <Card title={<span id={`setup-${s.id}-title`}>{s.title}</span>}>
                {s.rows.map((r) => (
                  <Link key={r.path} to={getPath(r.path)} className="row sp" style={{ padding: "8px 0", borderTop: "1px solid var(--bz-line)", fontWeight: 700, fontSize: 15, color: "inherit", textDecoration: "none" }} title={r.hint}>
                    {r.label}
                    <span style={{ color: "var(--bz-ink3)" }}><ChevronRight className="ic" aria-hidden /></span>
                  </Link>
                ))}
              </Card>
            </section>
          ))}
        </FormGrid>
      </BzPage>
    </AppLayout>
  );
}
