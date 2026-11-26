/**
 * P4 drop-in layer: same names and props as the legacy page template (components/page/booqi,
 * page/kit, reports/ReportsKit) but emitting the artifact kit markup (`.mainx`, `.pgt`, `.esx`,
 * `.stl`, `.st`, `.chip`, `.a-card`). Ported pages only change their import lines.
 */
import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Info } from "lucide-react";
import { BzScope, Chip, ChipRow, EmptyState as KitEmpty, SectionCard, StatusPill, Tile } from "./index";
import { P4Chips, P4HeadOnly } from "./p4-kit";
import { Delta } from "@/components/reports/ReportsKit";
import { fmtBy, type RangeKey, type Unit } from "@/components/reports/reportsFormat";
import type { Lifecycle } from "@/components/page/kitStyles";
import { t, type TKey } from "@/i18n";

/** Body wrapper class (replaces the padded legacy body; `.mainx` already pads). */
export const pageBody = "grid content-start gap-4";

/** Page scope: kit surface + content column. Header and body are its children. */
export function BooqiScope({ children }: { children: ReactNode }) {
  return <P4Frame>{children}</P4Frame>;
}

function P4Frame({ children }: { children: ReactNode }) {
  return (
    <BzScope>
      <div className="mainx bz-surface" style={{ overflow: "visible", minHeight: "100%" }}>
        {children}
      </div>
    </BzScope>
  );
}

/** `.pgt` header (title + subtitle left, actions right, help "?" kept). */
export function PageHeader({ title, subtitle, actions, helpSlug }: { title: string; subtitle?: string; actions?: ReactNode; className?: string; helpSlug?: string }) {
  return <P4HeadOnly title={title} sub={subtitle} right={actions} helpSlug={helpSlug} />;
}

/** `.esx` empty state. */
export function EmptyState({ icon: Icon, title, body, action }: { icon: LucideIcon; title: string; body?: string; action?: ReactNode }) {
  return <KitEmpty icon={<Icon className="ic" />} title={title} text={body} action={action} />;
}

/** `.esx` for the legacy `Empty` one-liners. */
export function Empty({ children }: { children: ReactNode }) {
  return <KitEmpty icon={<Info className="ic" />} title={children} />;
}

/** `.stl` stat tile. */
export function StatCard({ icon: Icon, label, value, hint }: { icon: LucideIcon; label: string; value: string | number; hint?: string; tone?: string; className?: string }) {
  return <Tile label={<span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><Icon size={14} aria-hidden /> {label}</span>} value={value} hint={hint} />;
}

/** `.st` status pill for the lifecycle chips (tokens, no raw colours). */
export function StatusChip({ status, label }: { status: Lifecycle; label?: string; className?: string }) {
  const kind = status === "active" ? "c" : status === "ended" ? "x" : status === "failed" ? "r" : status === "paused" || status === "queued" ? "w" : "d";
  const text: Record<Lifecycle, TKey> = { active: "common.active", scheduled: "common.scheduled", ended: "common.ended", draft: "page.draft", queued: "page.queued", failed: "page.failed", paused: "page.paused" } as Record<Lifecycle, TKey>;
  return <StatusPill kind={kind}>{label ?? t(text[status])}</StatusPill>;
}

/** Chip row filter (artifact `.chs`). */
export function FilterChips<T extends string>({ value, onChange, options, label }: { value: T; onChange: (v: T) => void; options: { value: T; label: string; count?: number }[]; label: string }) {
  return <P4Chips label={label} items={options.map((o) => ({ key: o.value, label: o.count != null ? `${o.label} · ${o.count}` : o.label }))} value={value} onChange={onChange} />;
}

/** Period switch as chips. */
export function PeriodPicker({ value, onChange, ranges }: { value: RangeKey; onChange: (r: RangeKey) => void; ranges?: readonly RangeKey[] }) {
  const list = ranges ?? (["today", "7d", "30d", "mtd", "lastMonth", "90d", "12m"] as RangeKey[]);
  return <P4Chips label={t("reports.period")} items={list.map((r) => ({ key: r, label: t(`reports.range.${r}` as TKey) }))} value={value} onChange={onChange} />;
}

/** `.a-card` section with title/hint/action. */
export function Panel({ title, hint, action, children, className }: { title: string; hint?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={className} style={{ minWidth: 0 }}>
      <SectionCard title={title} hint={hint} right={action}>
        {children}
      </SectionCard>
    </div>
  );
}

/** Linked `.stl` KPI tile with the change badge. */
export function KpiTile({ to, label, value, previous, unit, goodWhen, foot }: { to: string; label: string; value: number; previous: number; unit: Unit; goodWhen?: "up" | "down"; foot?: ReactNode }) {
  return (
    <Link to={to} style={{ color: "inherit", textDecoration: "none", display: "block" }}>
      <Tile
        label={label}
        value={fmtBy(unit, value)}
        hint={
          <span style={{ display: "inline-flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
            <Delta value={value} previous={previous} unit={unit} goodWhen={goodWhen} />
            {foot ?? <span>{t("reports.wasValue", { value: fmtBy(unit, previous) })}</span>}
          </span>
        }
      />
    </Link>
  );
}

/** Chips shown as a plain row (re-export for pages that build their own). */
export { Chip, ChipRow };
