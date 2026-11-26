import type { ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { t } from "@/i18n";
import { BzScope, PageHead, cx } from "@/components/bz";
import { useVisibleSettings } from "@/components/layout/navigation";
import { useNavigation } from "@/utils/navigationUtils";

/** The "?" link to a help article that the old PageHeader showed (kept: real feature). */
export function HelpLink({ slug }: { slug: string }) {
  const { salonKey } = useParams<{ salonKey?: string }>();
  if (!salonKey) return null;
  return (
    <Link to={`/${salonKey}/help/${slug}`} className="circ" aria-label={t("helpCenter.helpLink")} title={t("helpCenter.helpLink")} style={{ width: 32, height: 32, fontWeight: 800, color: "var(--bz-muted)", textDecoration: "none" }}>
      ?
    </Link>
  );
}

/** Page body for a ported page rendered inside AppLayout: sand surface + `.mainx` padding (artifact BF58). */
export function BzPage({ children }: { children: ReactNode }) {
  return (
    <BzScope>
      <div className="mainx bz-surface" style={{ overflow: "visible", minHeight: "100%" }}>
        {children}
      </div>
    </BzScope>
  );
}

/**
 * Artifact settings frame: `.pgt` head (title, sub, one primary on the right) over `.sp2`
 * [250px rail of every settings group | `.stk` content]. The rail is the real settings map.
 */
export function SettingsFrame({ title, sub, right, helpSlug, children }: { title: ReactNode; sub?: ReactNode; right?: ReactNode; helpSlug?: string; children?: ReactNode }) {
  const { getPath } = useNavigation();
  const location = useLocation();
  const groups = useVisibleSettings();
  const here = location.pathname;
  return (
    <BzPage>
      <PageHead title={title} sub={sub} right={<>{helpSlug ? <HelpLink slug={helpSlug} /> : null}{right}</>} />
      <div className="sp2" style={{ gridTemplateColumns: "250px 1fr" }}>
        <div>
          <div className="rail" style={{ gap: 0 }}>
            {groups.map((g) => (
              <div key={g.id} style={{ display: "contents" }}>
                <div className="lbl" style={{ fontWeight: 800, padding: "12px 14px 4px" }}>{g.title}</div>
                {g.rows.map((r) => {
                  const to = getPath(r.path);
                  const on = here === to || here.startsWith(to + "/");
                  return (
                    <Link
                      key={r.path}
                      to={to}
                      className={cx(on && "on")}
                      style={{ display: "block", padding: "9px 14px", borderRadius: 12, fontSize: 15, fontWeight: 700, ...(on ? { background: "var(--bz-vsoft)", color: "var(--bz-vtext)" } : { color: "var(--bz-muted)" }) }}
                    >
                      {r.label}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        <div className="stk">{children}</div>
      </div>
    </BzPage>
  );
}
