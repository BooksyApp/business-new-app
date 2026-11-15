import { ServiceChip } from "@/components/ServiceChip";
import { AppLayout } from "@/components/layout/AppLayout";
import { BooqiScope, PageHeader, Card, CardContent, CardDescription, CardHeader, CardTitle, EmptyState, StatCard } from "@/components/page/booqi";
import { pageBody, primaryBtn, secondaryBtn } from "@/components/page/booqiStyles";
import { clientColorClasses } from "@/lib/appointmentVisuals";
import { Button } from "@/components/ui/button";
import { Star, ThumbsUp, MessageSquare, TrendingUp, Reply, Clock, Send } from "lucide-react";
import { format } from "@/i18n/dateFns";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { assetUrl, getCurrentBusinessId } from "@/config/api";
import { reviewService, ratingBreakdown, type Review, type RatingSummary } from "@/services/reviewService";
import { t } from "@/i18n";

// #25: this page shipped with hardcoded demo reviews — invented client names,
// invented comments and an invented 4.8 average from 128 reviews — on a screen a salon
// owner would read as their real reputation. ReviewController has existed all along;
// nothing here had ever called it.
//
// The API returns rating, comment, createdAt and staffId. It does NOT return a client
// name or a service name, so those are not shown rather than fabricated.


function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={16}
          className={star <= rating ? "fill-appointment-yellow text-appointment-yellow" : "text-border"}
        />
      ))}
    </div>
  );
}

export default function ReviewsPage() {
  const businessId = getCurrentBusinessId();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [summary, setSummary] = useState<RatingSummary>({ count: 0, average: null });
  const [loading, setLoading] = useState(true);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [savingReply, setSavingReply] = useState(false);
  // How many customers could be asked. Shown on the button so a salon knows whether
  // pressing it will do anything before it does.
  const [requestCount, setRequestCount] = useState(0);
  const [requesting, setRequesting] = useState(false);
  const [filter, setFilter] = useState<"all" | "reply" | "photos" | number>("all");
  const [sortBy, setSortBy] = useState<"newest" | "lowest">("newest");

  const saveReply = async (reviewId: number, text?: string) => {
    if (!businessId) return;
    setSavingReply(true);
    try {
      const updated = await reviewService.reply(businessId, reviewId, text ?? replyText);
      setReviews(prev => prev.map(r => (r.id === reviewId ? updated : r)));
      setReplyingTo(null);
      setReplyText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("reviews.couldNotPostYourReply"));
    } finally {
      setSavingReply(false);
    }
  };

  const sendRequests = async () => {
    if (!businessId) return;
    setRequesting(true);
    try {
      const res = await reviewService.sendRequests(businessId);
      toast.success(
        res.requested > 0
          ? t("reviews.askedToReview", { count: res.requested })
          : t("reviews.nobodyToAskRightNow")
      );
      setRequestCount(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("reviews.couldNotSendReviewRequests"));
    } finally {
      setRequesting(false);
    }
  };

  useEffect(() => {
    if (!businessId) { setLoading(false); return; }
    Promise.all([
      reviewService.getByBusiness(businessId),
      reviewService.getSummary(businessId),
    ])
      .then(([list, sum]) => { setReviews(list || []); setSummary(sum || { count: 0, average: null }); })
      .catch(() => { setReviews([]); setSummary({ count: 0, average: null }); })
      .finally(() => setLoading(false));
  }, [businessId]);

  useEffect(() => {
    if (!businessId) return;
    reviewService
      .requestPreview(businessId)
      .then(p => setRequestCount(p.count))
      .catch(() => setRequestCount(0));
  }, [businessId]);

  const breakdown = ratingBreakdown(reviews);

  const now = new Date();
  const newThisMonth = reviews.filter((r) => {
    const d = new Date(r.createdAt);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;
  const positivePercent = reviews.length
    ? Math.round((reviews.filter((r) => r.rating >= 4).length / reviews.length) * 100)
    : 0;
  const repliedPercent = reviews.length
    ? Math.round((reviews.filter((r) => r.reply && r.reply.trim()).length / reviews.length) * 100)
    : 0;

  // Filters and sort over the loaded reviews.
  const needsReply = (r: Review) => !r.reply || !r.reply.trim();
  const counts = {
    all: reviews.length,
    reply: reviews.filter(needsReply).length,
    photos: reviews.filter((r) => (r.photos?.length ?? 0) > 0).length,
  };
  const shown = reviews
    .filter((r) =>
      filter === "all" ? true : filter === "reply" ? needsReply(r) : filter === "photos" ? (r.photos?.length ?? 0) > 0 : r.rating === filter,
    )
    .sort((a, b) => (sortBy === "lowest" ? a.rating - b.rating || +new Date(b.createdAt) - +new Date(a.createdAt) : +new Date(b.createdAt) - +new Date(a.createdAt)));
  // Average time to reply, from reviews that have one.
  const replyHours = reviews
    .filter((r) => r.reply && r.repliedAt)
    .map((r) => (+new Date(r.repliedAt!.replace(" ", "T")) - +new Date(r.createdAt.replace(" ", "T"))) / 36e5)
    .filter((h) => Number.isFinite(h) && h >= 0);
  const avgReply = replyHours.length ? replyHours.reduce((s, h) => s + h, 0) / replyHours.length : null;
  const avgReplyLabel = avgReply == null ? null : avgReply < 1 ? "under an hour" : avgReply < 48 ? `${Math.round(avgReply)} h` : `${Math.round(avgReply / 24)} days`;
  const when = (d: string) => {
    try {
      return format(new Date(d.replace(" ", "T")), "d MMM yyyy");
    } catch {
      return d;
    }
  };
  const initials = (name: string | null) =>
    (name || "Client").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join("");
  const chip = (on: boolean) =>
    cn(
      "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ring-1 transition",
      on ? "bg-[rgb(var(--reg-ink))] text-white ring-[rgb(var(--reg-ink))]" : "bg-white text-[rgb(var(--reg-ink)/0.8)] ring-[rgb(var(--reg-line))] hover:ring-[rgb(var(--reg-brand)/0.4)]",
    );

  const scoreTone =
    (summary.average ?? 0) >= 4 ? "text-emerald-600" : (summary.average ?? 0) >= 3 ? "text-amber-600" : summary.average != null ? "text-rose-600" : "text-[rgb(var(--reg-muted))]";
  const filterLabel =
    filter === "all" ? null : filter === "reply" ? t("reviews.needsReply") : filter === "photos" ? t("reviews.withPhotos") : `${filter}★`;

  return (
    <AppLayout>
      <BooqiScope>
        <PageHeader
          title={t("common.reviews")}
          subtitle={t("reviews.whatClientsSaidAndWhat")}
          actions={
            <Button
              className={primaryBtn}
              disabled={requesting || requestCount === 0}
              onClick={() => void sendRequests()}
              title={
                requestCount === 0
                  ? t("reviews.everyoneWhoHasBeenAnd")
                  : undefined
              }
            >
              <MessageSquare size={16} />
              {requesting
                ? t("reviews.sending")
                : requestCount > 0
                  ? t("reviews.askForReview", { count: requestCount })
                  : t("reviews.everyoneHasBeenAsked")}
            </Button>
          }
        />

        <div className="px-4 py-5 md:px-8 md:py-6">
          <div className="mx-auto grid max-w-[1080px] gap-6 lg:grid-cols-[300px_minmax(0,1fr)] lg:gap-8">
            {/* Summary — one row on a phone, a sticky card beside the feed on a desktop. */}
            <aside className="lg:sticky lg:top-[120px] lg:self-start">
              <div className="flex items-center gap-4 rounded-[20px] bg-white p-4 ring-1 ring-[rgb(var(--reg-line)/0.8)] lg:hidden">
                <p className={cn("text-[36px] font-extrabold leading-none tracking-[-0.04em]", scoreTone)}>
                  {summary.average != null ? summary.average.toFixed(1) : "–"}
                </p>
                <div className="min-w-0 flex-1">
                  <StarRating rating={Math.round(summary.average ?? 0)} />
                  <p className="mt-0.5 text-sm text-[rgb(var(--reg-muted))]">{summary.count} {summary.count === 1 ? t("reviews.review") : t("reviews.reviews")}</p>
                </div>
                {counts.reply > 0 && (
                  <button type="button" onClick={() => setFilter("reply")} className="shrink-0 rounded-full bg-rose-50 px-3 py-1.5 text-sm font-semibold text-rose-800 ring-1 ring-rose-200">
                    {t("reviews.toReply", { reply: counts.reply })}
                  </button>
                )}
              </div>

              <div className="hidden rounded-[24px] bg-white p-6 ring-1 ring-[rgb(var(--reg-line)/0.8)] lg:block">
                <div className="flex items-end gap-3">
                  <p className={cn("text-[64px] font-extrabold leading-[0.9] tracking-[-0.05em]", scoreTone)}>
                    {summary.average != null ? summary.average.toFixed(1) : "–"}
                  </p>
                  <div className="pb-1">
                    <StarRating rating={Math.round(summary.average ?? 0)} />
                    <p className="mt-1 text-sm text-[rgb(var(--reg-muted))]">{summary.count} {summary.count === 1 ? t("reviews.review") : t("reviews.reviews")}</p>
                  </div>
                </div>
                <ul className="mt-6 space-y-1.5" aria-label={t("reviews.ratingDistribution")}>
                  {breakdown.map((item) => (
                    <li key={item.stars}>
                      <button
                        type="button"
                        onClick={() => setFilter(filter === item.stars ? "all" : item.stars)}
                        aria-pressed={filter === item.stars}
                        className={cn("flex w-full items-center gap-3 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-[rgb(var(--reg-canvas))]", filter === item.stars && "bg-[rgb(var(--reg-brand-soft))]")}
                      >
                        <span className="w-6 text-sm font-semibold tabular-nums">{item.stars}★</span>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-[rgb(var(--reg-ink)/0.06)]">
                          <span className="block h-full rounded-full bg-[linear-gradient(90deg,rgb(var(--reg-brand)),rgb(var(--reg-mesh-2)))]" style={{ width: `${item.percent}%` }} />
                        </span>
                        <span className="w-6 text-right text-sm tabular-nums text-[rgb(var(--reg-muted))]">{item.count}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                {counts.reply > 0 ? (
                  <button
                    type="button"
                    onClick={() => setFilter("reply")}
                    className="mt-6 flex w-full items-center justify-between rounded-2xl bg-rose-50 px-4 py-3 text-left ring-1 ring-rose-200 transition hover:bg-rose-100/70"
                  >
                    <span>
                      <span className="block text-sm font-bold text-rose-900">{t("reviews.needReply", { count: counts.reply })}</span>
                      <span className="block text-xs text-rose-800/80">{t("reviews.answeringPubliclyBuildsTrust")}</span>
                    </span>
                    <Reply size={18} className="text-rose-700" />
                  </button>
                ) : reviews.length > 0 ? (
                  <p className="mt-6 rounded-2xl bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900 ring-1 ring-emerald-200">{t("reviews.everyReviewHasAReply")}</p>
                ) : null}
                <dl className="mt-5 space-y-2 border-t border-[rgb(var(--reg-line)/0.7)] pt-4 text-sm">
                  <div className="flex justify-between"><dt className="text-[rgb(var(--reg-muted))]">{t("reviews.replied")}</dt><dd className="font-semibold">{reviews.length ? `${repliedPercent}%` : "—"}</dd></div>
                  {avgReplyLabel && <div className="flex justify-between"><dt className="text-[rgb(var(--reg-muted))]">{t("reviews.avgReplyTime")}</dt><dd className="font-semibold">{avgReplyLabel}</dd></div>}
                  <div className="flex justify-between"><dt className="text-[rgb(var(--reg-muted))]">{t("reviews.newThisMonth")}</dt><dd className="font-semibold">{newThisMonth}</dd></div>
                  <div className="flex justify-between"><dt className="text-[rgb(var(--reg-muted))]">{t("reviews.andUp")}</dt><dd className="font-semibold">{reviews.length ? `${positivePercent}%` : "—"}</dd></div>
                </dl>
              </div>
            </aside>

            {/* Feed */}
            <section className="min-w-0" aria-label={t("common.reviews")}>
              <div className="flex flex-wrap items-center gap-2">
                <div className="-mx-4 flex min-w-0 basis-full gap-2 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none] md:mx-0 md:basis-auto md:flex-1 md:flex-wrap md:overflow-visible md:px-0" role="tablist" aria-label={t("reviews.filterReviews")}>
                  <button type="button" role="tab" aria-selected={filter === "all"} onClick={() => setFilter("all")} className={chip(filter === "all")}>{t("common.all")}{" "}<span className="text-xs opacity-70">{counts.all}</span></button>
                  <button type="button" role="tab" aria-selected={filter === "reply"} onClick={() => setFilter("reply")} className={chip(filter === "reply")}>{t("reviews.needsReply")}{" "}<span className="text-xs opacity-70">{counts.reply}</span></button>
                  {counts.photos > 0 && (
                    <button type="button" role="tab" aria-selected={filter === "photos"} onClick={() => setFilter("photos")} className={chip(filter === "photos")}>{t("reviews.withPhotos")}{" "}<span className="text-xs opacity-70">{counts.photos}</span></button>
                  )}
                  {[5, 4, 3, 2, 1].map((n) => (
                    <button key={n} type="button" role="tab" aria-selected={filter === n} onClick={() => setFilter(n)} className={chip(filter === n)}>{n}★</button>
                  ))}
                </div>
                <label className="ml-auto flex shrink-0 items-center gap-2 text-sm text-[rgb(var(--reg-muted))]">
                  {t("reviews.sort")}
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value as "newest" | "lowest")}
                    className="h-9 rounded-full border border-[rgb(var(--reg-line))] bg-white px-3 text-sm font-semibold text-[rgb(var(--reg-ink))]"
                  >
                    <option value="newest">{t("reviews.newest")}</option>
                    <option value="lowest">{t("reviews.lowestRating")}</option>
                  </select>
                </label>
              </div>

              <div className="mt-5">
                {loading ? (
                  <p className="text-sm text-[rgb(var(--reg-muted))]">{t("reviews.loadingReviews")}</p>
                ) : reviews.length === 0 ? (
                  <EmptyState
                    icon={Star}
                    title={t("reviews.noReviewsYet")}
                    body={t("reviews.aClientCanReviewA")}
                  />
                ) : shown.length === 0 ? (
                  <EmptyState
                    icon={Star}
                    title={filterLabel ? t("reviews.noReviews", { value: filterLabel.toLowerCase() }) : t("reviews.nothingHere")}
                    body={t("reviews.tryAnotherFilterOrShow")}
                    action={<Button className={secondaryBtn} variant="outline" onClick={() => setFilter("all")}>{t("reviews.showAll")}</Button>}
                  />
                ) : (
                  <ul className="divide-y divide-[rgb(var(--reg-line)/0.7)] rounded-[24px] bg-white ring-1 ring-[rgb(var(--reg-line)/0.8)]">
                    {shown.map((review) => (
                      <li key={review.id} className="px-5 py-6 md:px-7">
                        <div className="flex items-start gap-3">
                          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-bold", clientColorClasses(review.authorName || `review-${review.id}`))}>
                            {initials(review.authorName)}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-baseline justify-between gap-3">
                              <p className="truncate font-semibold">{review.authorName || t("reviews.aClient")}</p>
                              <p className="shrink-0 text-xs text-[rgb(var(--reg-muted))]">{when(review.createdAt)}</p>
                            </div>
                            <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1">
                              <StarRating rating={review.rating} />
                              {(review.serviceName || review.staffName) && (
                                <span className="flex min-w-0 items-baseline gap-x-1 whitespace-nowrap text-sm text-[rgb(var(--reg-muted))]">
                                  {review.serviceName && <ServiceChip services={review.services} fallback={review.serviceName} />}
                                  {review.serviceName && review.staffName ? <span>·</span> : null}
                                  {review.staffName ? <span className="truncate">{t("reviews.with", { staffName: review.staffName })}</span> : null}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="md:pl-[52px]">
                          {review.comment ? (
                            <p className="mt-3 whitespace-pre-wrap text-[15px] leading-[1.65]">{review.comment}</p>
                          ) : (
                            <p className="mt-3 text-sm italic text-[rgb(var(--reg-muted))]">{t("reviews.ratedWithoutAComment")}</p>
                          )}

                          {review.photos && review.photos.length > 0 && (
                            <div className="mt-3 flex gap-2">
                              {review.photos.map((src) => (
                                <a key={src} href={assetUrl(src)} target="_blank" rel="noopener noreferrer" className="h-24 w-24 overflow-hidden rounded-2xl ring-1 ring-[rgb(var(--reg-line))] transition hover:opacity-90">
                                  <img src={assetUrl(src)} alt={t("reviews.photoFromThisReview")} className="h-full w-full object-cover" loading="lazy" />
                                </a>
                              ))}
                            </div>
                          )}

                          {replyingTo === review.id ? (
                            <div className="mt-4 rounded-2xl bg-[rgb(var(--reg-brand-soft))] p-3 ring-1 ring-[rgb(var(--reg-brand)/0.2)]">
                              <Textarea
                                autoFocus
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder={t("reviews.replyPubliclyTo", { value: review.authorName || t("reviews.thisClient") })}
                                rows={3}
                                aria-label={t("reviews.yourReply")}
                                className="rounded-xl border-0 bg-white text-base shadow-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--reg-brand)/0.4)]"
                              />
                              <div className="mt-2 flex flex-wrap items-center justify-end gap-2">
                                {review.reply ? (
                                  <Button variant="ghost" className="mr-auto h-10 rounded-full text-rose-700" disabled={savingReply} onClick={() => void saveReply(review.id, "")}>
                                    {t("reviews.removeReply")}
                                  </Button>
                                ) : null}
                                <Button variant="ghost" className="h-10 rounded-full" onClick={() => setReplyingTo(null)}>{t("common.cancel")}</Button>
                                <Button className={cn(primaryBtn, "h-10")} disabled={savingReply || !replyText.trim()} onClick={() => void saveReply(review.id)}>
                                  <Send size={15} /> {savingReply ? t("reviews.sending") : t("reviews.send")}
                                </Button>
                              </div>
                            </div>
                          ) : review.reply ? (
                            <div className="mt-4 rounded-2xl rounded-tl-md bg-[rgb(var(--reg-brand-soft))] px-4 py-3">
                              <div className="flex items-center justify-between gap-2">
                                <p className="text-xs font-bold text-[rgb(var(--reg-brand-strong))]">
                                  {t("reviews.yourReply")}{review.repliedAt ? <span className="font-medium text-[rgb(var(--reg-muted))]"> · {when(review.repliedAt)}</span> : null}
                                </p>
                                <button type="button" onClick={() => { setReplyingTo(review.id); setReplyText(review.reply ?? ""); }} className="text-xs font-semibold text-[rgb(var(--reg-brand-strong))] hover:underline">
                                  {t("common.edit")}
                                </button>
                              </div>
                              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-[rgb(var(--reg-ink)/0.85)]">{review.reply}</p>
                            </div>
                          ) : (
                            <button
                              type="button"
                              onClick={() => { setReplyingTo(review.id); setReplyText(""); }}
                              className={cn(
                                "mt-4 inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold transition",
                                review.rating <= 3 ? "bg-rose-50 text-rose-800 ring-1 ring-rose-200 hover:bg-rose-100" : "text-[rgb(var(--reg-brand-strong))] ring-1 ring-[rgb(var(--reg-line))] hover:bg-[rgb(var(--reg-brand-soft))]",
                              )}
                            >
                              <Reply size={15} />{" "}{t("reviews.reply")}
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </section>
          </div>
        </div>
      </BooqiScope>
    </AppLayout>
  );
}



























