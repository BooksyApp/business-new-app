import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { BzScope, Chip, ChipRow, ErrorState, PageHead, Skeleton, StatusPill } from "./index";
import { t, type TKey } from "@/i18n";

/** P4 page frame: `.mainx` content column + `.pgt` PageHead (keeps the optional help "?" link). */
export function P4Page({ title, sub, right, helpSlug, children }: { title: string; sub?: string; right?: ReactNode; helpSlug?: string; children?: ReactNode }) {
  const { salonKey } = useParams<{ salonKey?: string }>();
  return (
    <BzScope>
      <div className="mainx" style={{ overflow: "visible" }}>
        <PageHead
          title={
            <>
              {title}
              {helpSlug && salonKey ? (
                <Link to={`/${salonKey}/help/${helpSlug}`} aria-label={t("helpCenter.helpLink")} title={t("helpCenter.helpLink")} style={{ marginLeft: 8, fontSize: 13, fontWeight: 700, opacity: 0.7 }}>
                  ?
                </Link>
              ) : null}
            </>
          }
          sub={sub}
          right={right}
        />
        <div style={{ display: "grid", gap: 16 }}>{children}</div>
      </div>
    </BzScope>
  );
}

/** Chip row radiogroup (artifact `.chs` period switch). */
export function P4Chips<K extends string>({ items, value, onChange, label }: { items: Array<{ key: K; label: ReactNode }>; value: K; onChange: (k: K) => void; label?: string }) {
  return (
    <div role="radiogroup" aria-label={label}>
      <ChipRow>
        {items.map((i) => (
          <span key={i.key} role="radio" aria-checked={i.key === value} tabIndex={0} onClick={() => onChange(i.key)} onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onChange(i.key)}>
            <Chip on={i.key === value}>{i.label}</Chip>
          </span>
        ))}
      </ChipRow>
    </div>
  );
}

/** Ledger status -> kit pill (tokens only, no raw amber/slate). */
export function LedgerPill({ status }: { status: string }) {
  const kind = status === "PAID" ? "c" : status === "PARTIAL" || status === "OWED" ? "w" : status === "VOID" ? "x" : "d";
  return <StatusPill kind={kind}>{t(`ledger.s.${status}` as TKey)}</StatusPill>;
}

/** Skeleton block for loading. */
export const P4Loading = () => <div aria-busy="true"><Skeleton lines={[100, 85, 92, 70, 88]} /></div>;

/** Failed load. */
export const P4Error = ({ title, action }: { title: string; action?: ReactNode }) => <ErrorState icon={<AlertTriangle className="ic" />} title={title} action={action} />;
