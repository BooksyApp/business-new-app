import type { Id } from "@/types/id";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, X } from "lucide-react";

import { businessService } from "@/services/businessService";
import { moneyService } from "@/services/moneyService";
import { Card, RowItem, StatusPill } from "@/components/bz";
import { t } from "@/i18n";

/**
 * First-login checklist: hours, services, team, photos, payments (a payout account), go live. Each step
 * ticks itself from the salon's real data (readiness rules, money settings). Gone when all are done, or
 * when the owner dismisses it (remembered per salon in this browser).
 */
const STEPS = [
  { key: "hours", to: "business-hours", label: "shareKit.guideHours" },
  { key: "services", to: "services", label: "shareKit.guideServices" },
  { key: "staff", to: "staff", label: "shareKit.guideStaff" },
  { key: "photos", to: "photos", label: "shareKit.guidePhotos" },
  { key: "payments", to: "money", label: "shareKit.guidePayments" },
  { key: "publish", to: "booking-rules", label: "shareKit.guidePublish" },
] as const;

const dismissKey = (businessId: Id) => `setup-guide-dismissed:${businessId}`;

function wasDismissed(businessId: Id): boolean {
  try {
    return localStorage.getItem(dismissKey(businessId)) === "1";
  } catch {
    return false;
  }
}

export function SetupGuide({ businessId }: { businessId: Id }) {
  const [open, setOpen] = useState<string[] | null>(null);
  const [bookable, setBookable] = useState(false);
  // Payments: done once a payout account (IBAN) is on file. null = not known (no permission / error).
  const [paid, setPaid] = useState<boolean | null>(null);
  const [dismissed, setDismissed] = useState(() => wasDismissed(businessId));

  useEffect(() => {
    let live = true;
    setDismissed(wasDismissed(businessId));
    businessService
      .getReadiness(businessId)
      .then((r) => {
        if (!live) return;
        setOpen([...(r.missing ?? []), ...(r.recommended ?? [])]);
        setBookable(!!r.bookable);
      })
      .catch(() => live && setOpen(null));
    moneyService
      .getSettings(businessId)
      .then((m) => live && setPaid(!!(m.payout_iban && m.payout_iban.trim())))
      .catch(() => live && setPaid(null));
    return () => {
      live = false;
    };
  }, [businessId]);

  if (!open || dismissed) return null;
  const done = STEPS.map((s) =>
    s.key === "publish" ? bookable : s.key === "payments" ? paid === true : !open.includes(s.key),
  );
  const count = done.filter(Boolean).length;
  if (count === STEPS.length) return null;

  return (
    <Card title={t("shareKit.guideTitle")} help={t("shareKit.guideBody")}>
      <div className="row sp">
        <StatusPill kind="w">{t("shareKit.guideDone", { done: count, total: STEPS.length })}</StatusPill>
        <button
          type="button"
          aria-label={t("shareKit.guideDismiss")}
          title={t("shareKit.guideDismiss")}
          className="circ"
          style={{ border: 0, cursor: "pointer" }}
          onClick={() => {
            try {
              localStorage.setItem(dismissKey(businessId), "1");
            } catch {
              /* private mode: hidden for this visit only */
            }
            setDismissed(true);
          }}
        >
          <X size={16} aria-hidden />
        </button>
      </div>
      <div style={{ display: "flex", gap: 4 }} role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={count}>
        {STEPS.map((s, i) => (
          <i key={s.key} style={{ flex: 1, height: 5, borderRadius: 9, background: done[i] ? "var(--bz-violet)" : "var(--bz-line)" }} />
        ))}
      </div>
      <div className="stk">
        {STEPS.map((s, i) => (
          <Link key={s.key} to={`/${businessId}/${s.to}`} style={{ color: "inherit", textDecoration: "none" }}>
            <RowItem
              left={
                <span className="circ" style={{ width: 32, height: 32, fontWeight: 800, fontSize: 13, ...(done[i] ? { background: "var(--bz-ok)", color: "#fff" } : { color: "var(--bz-muted)" }) }}>
                  {done[i] ? <Check size={14} aria-hidden /> : i + 1}
                </span>
              }
              title={<span style={done[i] ? { color: "var(--bz-muted)", textDecoration: "line-through" } : undefined}>{t(s.label)}</span>}
              right={!done[i] ? <ChevronRight size={16} style={{ color: "var(--bz-ink3)" }} aria-hidden /> : undefined}
            />
          </Link>
        ))}
      </div>
    </Card>
  );
}
