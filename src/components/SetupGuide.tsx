import type { Id } from "@/types/id";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight, X } from "lucide-react";

import { businessService } from "@/services/businessService";
import { moneyService } from "@/services/moneyService";
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
    <section className="rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold">{t("shareKit.guideTitle")}</h2>
        <span className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[rgb(var(--reg-brand-strong))]">{t("shareKit.guideDone", { done: count, total: STEPS.length })}</span>
          <button
            type="button"
            aria-label={t("shareKit.guideDismiss")}
            title={t("shareKit.guideDismiss")}
            className="rounded-full p-1 text-[rgb(var(--reg-muted))] hover:bg-[rgb(var(--reg-canvas))]"
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
        </span>
      </div>
      <p className="mt-1 text-sm text-[rgb(var(--reg-muted))]">{t("shareKit.guideBody")}</p>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[rgb(var(--reg-ink)/0.06)]" role="progressbar" aria-valuemin={0} aria-valuemax={STEPS.length} aria-valuenow={count}>
        <div className="h-full rounded-full bg-[linear-gradient(90deg,rgb(var(--reg-brand)),rgb(var(--reg-brand-strong)))] transition-[width] duration-500" style={{ width: `${(count / STEPS.length) * 100}%` }} />
      </div>
      <ol className="mt-4 grid gap-1">
        {STEPS.map((s, i) => (
          <li key={s.key}>
            <Link to={`/${businessId}/${s.to}`} className="flex min-h-11 items-center gap-3 rounded-xl px-2 py-1.5 text-sm transition hover:bg-[rgb(var(--reg-canvas))]">
              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${done[i] ? "bg-[rgb(var(--reg-success))] text-white" : "ring-2 ring-inset ring-[rgb(var(--reg-line))] text-[rgb(var(--reg-muted))]"}`}>
                {done[i] ? <Check size={14} aria-hidden /> : i + 1}
              </span>
              <span className={`flex-1 font-semibold ${done[i] ? "text-[rgb(var(--reg-muted))] line-through decoration-1" : ""}`}>{t(s.label)}</span>
              {!done[i] && <ChevronRight size={16} className="text-[rgb(var(--reg-muted))]" aria-hidden />}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  );
}
