import type { Id } from "@/types/id";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Check, ChevronRight } from "lucide-react";

import { businessService } from "@/services/businessService";
import { shareDoneKey } from "@/components/ShareKitCard";
import { t } from "@/i18n";

/**
 * "Set up in 5 steps": services → team → hours → photos → share the link. Each step ticks itself
 * from the salon's real data (the backend's readiness rules) — the last one once the owner has
 * downloaded a share-kit file. Gone when all five are done.
 */
const STEPS = [
  { key: "services", to: "services", label: "shareKit.guideServices" },
  { key: "staff", to: "staff", label: "shareKit.guideStaff" },
  { key: "hours", to: "business-hours", label: "shareKit.guideHours" },
  { key: "photos", to: "photos", label: "shareKit.guidePhotos" },
  { key: "share", to: "business", label: "shareKit.guideShare" },
] as const;

export function SetupGuide({ businessId }: { businessId: Id }) {
  const [open, setOpen] = useState<string[] | null>(null);

  useEffect(() => {
    let live = true;
    businessService
      .getReadiness(businessId)
      .then((r) => live && setOpen([...(r.missing ?? []), ...(r.recommended ?? [])]))
      .catch(() => live && setOpen(null));
    return () => {
      live = false;
    };
  }, [businessId]);

  if (!open) return null;
  let shared = false;
  try {
    shared = localStorage.getItem(shareDoneKey(String(businessId))) === "1";
  } catch {
    /* private mode */
  }
  const done = STEPS.map((s) => (s.key === "share" ? shared : !open.includes(s.key)));
  const count = done.filter(Boolean).length;
  if (count === STEPS.length) return null;

  return (
    <section className="rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-base font-bold">{t("shareKit.guideTitle")}</h2>
        <span className="text-sm font-semibold text-[rgb(var(--reg-brand-strong))]">{t("shareKit.guideDone", { done: count, total: STEPS.length })}</span>
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
