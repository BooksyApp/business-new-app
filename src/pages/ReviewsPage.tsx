import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, MessageSquare, Star } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader } from "@/components/page/booqi";
import { pageBody, primaryBtn, secondaryBtn } from "@/components/page/booqiStyles";
import { fieldCls } from "@/components/page/kitStyles";
import { Empty } from "@/components/reports/ReportsKit";
import { fmtDay, loc } from "@/components/reports/reportsFormat";
import { reviewService, type Review, type ReviewReport } from "@/services/reviewService";
import { businessService } from "@/services/businessService";
import { useBusinessId } from "@/hooks/useBusinessId";
import { assetUrl } from "@/config/api";
import { formatDate, formatNumber } from "@/i18n/format";
import { cn } from "@/lib/utils";
import { t } from "@/i18n";
import type { Id } from "@/types/id";

/** Stars as one shape filled by the score; the number beside them carries the value. */
function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5" aria-hidden>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} size={size} className={i <= Math.round(value) ? "fill-[rgb(var(--reg-ink))] text-[rgb(var(--reg-ink))]" : "text-[rgb(var(--reg-ink)/0.2)]"} />
      ))}
    </span>
  );
}

const staffOf = (r: Review) => r.staffName || r.services?.find((s) => s.staffName)?.staffName || null;
const servicesOf = (r: Review) => (r.services?.length ? r.services.map((s) => s.name) : r.serviceName ? [r.serviceName] : []);

/**
 * Reviews (HUB-V3, 2026-11-19): a summary header — average, count, how the stars split and
 * how the monthly average moved — then the reviews with filters (stars, team member, service,
 * replied or not) and a reply box on each. The Google review link is a small card on the side.
 */
export default function ReviewsPage() {
  const businessId = useBusinessId();
  const qc = useQueryClient();
  const reviewsQ = useQuery({ queryKey: ["reviews", businessId], queryFn: () => reviewService.getByBusiness(businessId), enabled: Boolean(businessId) });
  const reportsQ = useQuery({ queryKey: ["review-reports", businessId], queryFn: () => reviewService.getReports(businessId), enabled: Boolean(businessId), retry: false });
  const reportOf = (id: Id) => (reportsQ.data ?? []).find((x) => String(x.reviewRef) === String(id));
  const preview = useQuery({ queryKey: ["review-requests", businessId], queryFn: () => reviewService.requestPreview(businessId), enabled: Boolean(businessId), retry: false });
  const [stars, setStars] = useState<number | null>(null);
  const [staff, setStaff] = useState("");
  const [service, setService] = useState("");
  const [replied, setReplied] = useState<"" | "no" | "yes">("");
  const [requesting, setRequesting] = useState(false);

  const all = useMemo(() => reviewsQ.data ?? [], [reviewsQ.data]);
  const staffNames = useMemo(() => [...new Set(all.map(staffOf).filter(Boolean) as string[])].sort(), [all]);
  const serviceNames = useMemo(() => [...new Set(all.flatMap(servicesOf))].sort(), [all]);
  const list = all.filter(
    (r) =>
      (stars === null || Math.round(r.rating) === stars) &&
      (!staff || staffOf(r) === staff) &&
      (!service || servicesOf(r).includes(service)) &&
      (!replied || (replied === "yes" ? Boolean(r.reply) : !r.reply)),
  );
  const unanswered = all.filter((r) => !r.reply).length;
  const requestCount = preview.data?.count ?? 0;

  const sendRequests = async () => {
    setRequesting(true);
    try {
      const res = await reviewService.sendRequests(businessId);
      toast.success(t("reviews.v3.requestsSent", { count: res.requested }));
      void preview.refetch();
    } catch {
      toast.error(t("reviews.v3.requestsFailed"));
    } finally {
      setRequesting(false);
    }
  };

  const selectCls = cn(fieldCls, "h-10 min-w-0 pr-8 text-[14px]");
  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={t("common.reviews")}
          subtitle={t("reviews.whatClientsSaidAndWhat")}
          actions={
            <button type="button" className={primaryBtn} disabled={requesting || requestCount === 0} onClick={() => void sendRequests()}>
              <MessageSquare size={16} aria-hidden />
              {requestCount > 0 ? t("reviews.askForReview", { count: requestCount }) : t("reviews.everyoneHasBeenAsked")}
            </button>
          }
        />
        <div className={pageBody}>
          {reviewsQ.isError ? (
            <Empty>{t("reviews.v3.loadFailed")}</Empty>
          ) : !reviewsQ.data ? (
            <div className="h-[220px] animate-pulse rounded-[20px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)] motion-reduce:animate-none" aria-busy="true" />
          ) : (
            <>
              <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
                <Summary reviews={all} onPick={(s) => setStars(stars === s ? null : s)} picked={stars} />
                <GoogleLinkCard businessId={businessId} />
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div role="radiogroup" aria-label={t("reviews.v3.byReply")} className="flex gap-1 rounded-full bg-white p-1 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                  {(["", "no", "yes"] as const).map((v) => (
                    <button
                      key={v || "all"}
                      type="button"
                      role="radio"
                      aria-checked={replied === v}
                      onClick={() => setReplied(v)}
                      className={cn("h-8 rounded-full px-3 text-[13px] font-semibold", replied === v ? "bg-[rgb(var(--reg-ink))] text-white" : "text-[rgb(var(--reg-ink)/0.65)] hover:text-[rgb(var(--reg-ink))]")}
                    >
                      {v === "" ? t("reviews.v3.all", { count: all.length }) : v === "no" ? t("reviews.v3.unanswered", { count: unanswered }) : t("reviews.v3.answered")}
                    </button>
                  ))}
                </div>
                {staffNames.length > 0 && (
                  <select aria-label={t("reviews.v3.staff")} className={selectCls} value={staff} onChange={(e) => setStaff(e.target.value)}>
                    <option value="">{t("reviews.v3.allStaff")}</option>
                    {staffNames.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                {serviceNames.length > 0 && (
                  <select aria-label={t("reviews.v3.service")} className={selectCls} value={service} onChange={(e) => setService(e.target.value)}>
                    <option value="">{t("reviews.v3.allServices")}</option>
                    {serviceNames.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                )}
                {stars !== null && (
                  <button type="button" onClick={() => setStars(null)} className="h-9 rounded-full bg-[rgb(var(--reg-brand-soft))] px-3 text-[13px] font-semibold text-[rgb(var(--reg-brand-strong))]">
                    {t("reviews.v3.starsFilter", { n: stars })} ×
                  </button>
                )}
              </div>

              {all.length === 0 ? (
                <Empty>{t("reviews.v3.none")}</Empty>
              ) : list.length === 0 ? (
                <Empty>{t("reviews.v3.noneMatch")}</Empty>
              ) : (
                <ul className="space-y-3">
                  {list.map((r) => (
                    <ReviewCard key={String(r.id)} review={r} businessId={businessId} report={reportOf(r.id)} onReported={() => qc.invalidateQueries({ queryKey: ["review-reports", businessId] })} onSaved={() => qc.invalidateQueries({ queryKey: ["reviews", businessId] })} />
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      </BooqiScope>
    </AppLayout>
  );
}

function Summary({ reviews, onPick, picked }: { reviews: Review[]; onPick: (s: number) => void; picked: number | null }) {
  const count = reviews.length;
  const avg = count ? reviews.reduce((a, r) => a + r.rating, 0) / count : 0;
  const dist = [5, 4, 3, 2, 1].map((s) => ({ s, n: reviews.filter((r) => Math.round(r.rating) === s).length }));
  // Monthly average for the last 6 months with reviews: a small trend, one accent.
  const months = useMemo(() => {
    const m = new Map<string, { sum: number; n: number }>();
    for (const r of reviews) {
      const k = String(r.createdAt).slice(0, 7);
      const e = m.get(k) ?? { sum: 0, n: 0 };
      e.sum += r.rating;
      e.n += 1;
      m.set(k, e);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).slice(-6).map(([k, v]) => ({ k, avg: v.sum / v.n, n: v.n }));
  }, [reviews]);
  const fmt1 = (v: number) => formatNumber(loc(), v, { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  return (
    <section className="grid gap-5 rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:grid-cols-[auto_minmax(0,1fr)_minmax(0,0.9fr)] md:p-6">
      <div>
        <p className="text-[48px] font-extrabold leading-none tracking-[-0.04em] tabular-nums">{count ? fmt1(avg) : "–"}</p>
        <div className="mt-2"><Stars value={avg} size={16} /></div>
        <p className="mt-1.5 text-[13px] text-[rgb(var(--reg-muted))]">{t("reviews.v3.count", { count })}</p>
      </div>
      <ul className="space-y-1.5" aria-label={t("reviews.v3.distribution")}>
        {dist.map(({ s, n }) => (
          <li key={s}>
            <button
              type="button"
              aria-pressed={picked === s}
              onClick={() => onPick(s)}
              className={cn("grid w-full grid-cols-[2.2rem_1fr_2.2rem] items-center gap-2 rounded-lg px-1 py-0.5 text-[13px] hover:bg-[rgb(var(--reg-canvas))]", picked === s && "bg-[rgb(var(--reg-brand-soft))]")}
            >
              <span className="font-semibold tabular-nums">{s} ★</span>
              <span className="h-2 rounded-full bg-[rgb(var(--rp-track))]" aria-hidden>
                <span className="block h-2 rounded-full bg-[rgb(var(--rp-accent))]" style={{ width: `${count ? (n / count) * 100 : 0}%` }} />
              </span>
              <span className="text-right tabular-nums text-[rgb(var(--reg-muted))]">{n}</span>
            </button>
          </li>
        ))}
      </ul>
      <div>
        <p className="mb-2 text-[13px] font-semibold text-[rgb(var(--reg-muted))]">{t("reviews.v3.trend")}</p>
        {months.length > 1 ? (
          <ol className="flex h-[92px] items-end gap-2" aria-label={t("reviews.v3.trend")}>
            {months.map((m) => (
              <li key={m.k} className="flex flex-1 flex-col items-center gap-1" title={t("reviews.v3.trendCell", { month: m.k, avg: fmt1(m.avg), count: m.n })}>
                <span className="text-[11.5px] font-semibold tabular-nums">{fmt1(m.avg)}</span>
                <span className="w-full max-w-[22px] rounded-t-[4px] bg-[rgb(var(--rp-accent))]" style={{ height: `${Math.max(6, ((m.avg - 1) / 4) * 52)}px` }} aria-hidden />
                <span className="text-[11px] text-[rgb(var(--reg-muted))]">{formatDate(loc(), `${m.k}-15T12:00:00`, { month: "short" })}</span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="text-[13px] text-[rgb(var(--reg-muted))]">{t("reviews.v3.trendSoon")}</p>
        )}
      </div>
    </section>
  );
}

const REPORT_REASONS = ["SPAM", "ABUSE", "FAKE", "PERSONAL_DATA", "OTHER"] as const;
const REASON_KEY: Record<string, string> = { SPAM: "reasonSpam", ABUSE: "reasonAbuse", FAKE: "reasonFake", PERSONAL_DATA: "reasonPersonal", OTHER: "reasonOther" };

function ReviewCard({ review: r, businessId, report, onReported, onSaved }: { review: Review; businessId: Id; report?: ReviewReport; onReported: () => void; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [reason, setReason] = useState<string>("SPAM");
  const [reportText, setReportText] = useState("");
  const [sendingReport, setSendingReport] = useState(false);
  const sendReport = async () => {
    setSendingReport(true);
    try {
      await reviewService.report(businessId, r.id, reason, reportText.trim());
      toast.success(t("reviews.v3.reportSent"));
      setReporting(false);
      setReportText("");
      onReported();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("reviews.v3.reportFailed"));
    } finally {
      setSendingReport(false);
    }
  };
  const caseOpen = report && report.status !== "CLOSED";
  const [text, setText] = useState(r.reply ?? "");
  const [saving, setSaving] = useState(false);
  const save = async (value: string) => {
    setSaving(true);
    try {
      await reviewService.reply(businessId, r.id, value);
      toast.success(value ? t("reviews.v3.replySaved") : t("reviews.v3.replyRemoved"));
      setOpen(false);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("reviews.v3.replyFailed"));
    } finally {
      setSaving(false);
    }
  };
  const staff = staffOf(r);
  const services = servicesOf(r);
  return (
    <li className="rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] md:p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <Stars value={r.rating} />
            <span className="sr-only">{t("reviews.v3.starsOf", { n: r.rating })}</span>
            <span className="font-semibold">{r.authorName || t("reviews.v3.client")}</span>
          </div>
          <p className="mt-0.5 text-[13px] text-[rgb(var(--reg-muted))]">
            {fmtDay(String(r.createdAt).slice(0, 10), { day: "numeric", month: "short", year: "numeric" })}
            {services.length ? ` · ${services.join(", ")}` : ""}
            {staff ? ` · ${staff}` : ""}
          </p>
        </div>
        {!r.reply && <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[12px] font-semibold text-amber-800 ring-1 ring-amber-200">{t("reviews.v3.needsReply")}</span>}
      </div>
      {r.comment && <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed">{r.comment}</p>}
      {r.photos?.length ? (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {r.photos.map((p) => (
            <img key={p} src={assetUrl(p)} alt="" loading="lazy" className="h-20 w-20 shrink-0 rounded-xl object-cover" />
          ))}
        </div>
      ) : null}

      {r.reply && !open && (
        <div className="mt-3 rounded-2xl bg-[rgb(var(--reg-canvas))] p-3.5">
          <p className="text-[12px] font-bold uppercase tracking-[0.06em] text-[rgb(var(--reg-muted))]">{t("reviews.v3.yourReply")}</p>
          <p className="mt-1 whitespace-pre-line text-[14px]">{r.reply}</p>
          <div className="mt-2 flex gap-3 text-[13px] font-semibold">
            <button type="button" className="text-[rgb(var(--reg-brand-strong))] hover:underline" onClick={() => { setText(r.reply ?? ""); setOpen(true); }}>{t("reviews.v3.edit")}</button>
            <button type="button" className="text-[rgb(var(--reg-muted))] hover:underline" disabled={saving} onClick={() => void save("")}>{t("reviews.v3.remove")}</button>
          </div>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-[13px]">
        {report && (
          <span
            data-testid="review-case-status"
            className="rounded-full bg-[rgb(var(--reg-canvas))] px-2.5 py-0.5 font-semibold ring-1 ring-[rgb(var(--reg-line)/0.8)]"
          >
            {t("reviews.v3.caseLabel")}: {t(report.status === "OPEN" ? "reviews.v3.caseOpen" : report.status === "REVIEWING" ? "reviews.v3.caseReviewing" : "reviews.v3.caseClosed")}
          </span>
        )}
        {!caseOpen && !reporting && (
          <button type="button" className="font-semibold text-[rgb(var(--reg-muted))] hover:underline" onClick={() => setReporting(true)}>
            {t("reviews.v3.report")}
          </button>
        )}
      </div>
      {reporting && (
        <div className="mt-2 space-y-2 rounded-2xl bg-[rgb(var(--reg-canvas))] p-3.5">
          <label className="text-[13px] font-semibold" htmlFor={`rr-${r.id}`}>{t("reviews.v3.reportReason")}</label>
          <select id={`rr-${r.id}`} className={cn(fieldCls, "h-10 w-full text-[14px]")} value={reason} onChange={(e) => setReason(e.target.value)}>
            {REPORT_REASONS.map((k) => <option key={k} value={k}>{t(`reviews.v3.${REASON_KEY[k]}`)}</option>)}
          </select>
          <textarea
            rows={3}
            maxLength={2000}
            aria-label={t("reviews.v3.reportComment")}
            className={cn(fieldCls, "h-auto w-full py-2.5 text-[14px]")}
            placeholder={t("reviews.v3.reportComment")}
            value={reportText}
            onChange={(e) => setReportText(e.target.value)}
          />
          <p className="text-[12px] text-[rgb(var(--reg-muted))]">{t("reviews.v3.reportHint")}</p>
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryBtn} onClick={() => setReporting(false)}>{t("common.cancel")}</button>
            <button type="button" className={primaryBtn} disabled={sendingReport} onClick={() => void sendReport()}>{t("reviews.v3.reportSend")}</button>
          </div>
        </div>
      )}
      {!r.reply && !open && (
        <button type="button" onClick={() => setOpen(true)} className="mt-3 text-[13.5px] font-semibold text-[rgb(var(--reg-brand-strong))] hover:underline">
          {t("reviews.v3.reply")}
        </button>
      )}
      {open && (
        <div className="mt-3 space-y-2">
          <label className="sr-only" htmlFor={`reply-${r.id}`}>{t("reviews.v3.reply")}</label>
          <textarea
            id={`reply-${r.id}`}
            autoFocus
            rows={3}
            maxLength={1000}
            className={cn(fieldCls, "h-auto w-full py-2.5 text-[14px]")}
            placeholder={t("reviews.v3.replyPlaceholder")}
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <button type="button" className={secondaryBtn} onClick={() => setOpen(false)}>{t("common.cancel")}</button>
            <button type="button" className={primaryBtn} disabled={saving || !text.trim()} onClick={() => void save(text.trim())}>{t("reviews.v3.publish")}</button>
          </div>
        </div>
      )}
    </li>
  );
}

function GoogleLinkCard({ businessId }: { businessId: Id }) {
  const qc = useQueryClient();
  const biz = useQuery({ queryKey: ["business", businessId], queryFn: () => businessService.getBusiness(businessId), enabled: Boolean(businessId), staleTime: 60_000 });
  const saved = biz.data?.googleReviewUrl ?? "";
  const [url, setUrl] = useState<string | null>(null);
  const value = url ?? saved;
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try {
      await businessService.setGoogleReviewUrl(businessId, value.trim());
      toast.success(t("bookingRules.reviewLinkSaved"));
      setUrl(null);
      void qc.invalidateQueries({ queryKey: ["business", businessId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("bookingRules.reviewLinkFailed"));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="rounded-[20px] bg-white p-5 ring-1 ring-[rgb(var(--reg-line)/0.8)]">
      <h2 className="text-[15px] font-extrabold">{t("reviews.v3.googleTitle")}</h2>
      <p className="mt-1 text-[13px] text-[rgb(var(--reg-muted))]">{t("reviews.v3.googleHint")}</p>
      <label className="sr-only" htmlFor="google-review-url">{t("reviews.v3.googleTitle")}</label>
      <input id="google-review-url" type="url" inputMode="url" className={cn(fieldCls, "mt-3 h-10 w-full text-[14px]")} placeholder={t("reviews.v3.googlePlaceholder")} value={value} onChange={(e) => setUrl(e.target.value)} />
      <div className="mt-2 flex items-center justify-between gap-2">
        {saved ? (
          <a href={saved} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[13px] font-semibold text-[rgb(var(--reg-brand-strong))] hover:underline">
            {t("reviews.v3.open")} <ExternalLink size={13} aria-hidden />
          </a>
        ) : <span />}
        <button type="button" className={secondaryBtn} disabled={busy || value.trim() === saved} onClick={() => void save()}>{t("common.save")}</button>
      </div>
    </section>
  );
}
