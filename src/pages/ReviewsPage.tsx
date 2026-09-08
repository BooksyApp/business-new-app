import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { clientColorClasses } from "@/lib/appointmentVisuals";
import { EmptyState, StatCard } from "@/components/ui/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, ThumbsUp, MessageSquare, TrendingUp, Reply } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { getCurrentBusinessId } from "@/config/api";
import { reviewService, ratingBreakdown, type Review, type RatingSummary } from "@/services/reviewService";

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

  const saveReply = async (reviewId: number, text?: string) => {
    if (!businessId) return;
    setSavingReply(true);
    try {
      const updated = await reviewService.reply(businessId, reviewId, text ?? replyText);
      setReviews(prev => prev.map(r => (r.id === reviewId ? updated : r)));
      setReplyingTo(null);
      setReplyText("");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not post your reply");
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
          ? `Asked ${res.requested} customer${res.requested === 1 ? "" : "s"} to review their visit`
          : "Nobody to ask right now"
      );
      setRequestCount(0);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not send review requests");
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

  return (
    <AppLayout>
      <PageHeader
        title="Reviews"
        subtitle="What clients said, and what you said back"
        actions={
          <Button 
            variant="outline"
            className="gap-2 border-border/60 hover:border-accent/30 hover:bg-accent/5 transition-all"
            disabled={requesting || requestCount === 0}
            onClick={() => void sendRequests()}
            title={
              requestCount === 0
                ? "Everyone who has been and paid in the last 30 days has already been asked or reviewed"
                : undefined
            }
          >
            <MessageSquare size={16} />
            {requesting
              ? "Sending…"
              : requestCount > 0
                ? `Ask ${requestCount} client${requestCount === 1 ? "" : "s"} for a review`
                : "Everyone has been asked"}
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Enhanced Stats Overview */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Enhanced Rating Summary */}
          <Card className="lg:col-span-1 bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-semibold">Overall rating</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-6">
                {/* Coloured by the score, not by the brand: a 2.1 printed in the same
                    handsome gradient as a 4.9 tells the owner nothing. */}
                <span
                  className={`text-5xl font-bold ${
                    (summary.average ?? 0) >= 4
                      ? "text-emerald-600"
                      : (summary.average ?? 0) >= 3
                        ? "text-amber-600"
                        : summary.average != null
                          ? "text-rose-600"
                          : "text-muted-foreground"
                  }`}
                >
                  {summary.average != null ? summary.average.toFixed(1) : "—"}
                </span>
                <div>
                  {/* Was hardcoded to five stars beside the real average, so a 2.0 salon
                      showed a perfect row. */}
                  <StarRating rating={Math.round(summary.average ?? 0)} />
                  <p className="text-sm text-muted-foreground font-medium mt-1">{summary.count} {summary.count === 1 ? "review" : "reviews"}</p>
                </div>
              </div>
              <div className="space-y-2.5">
                {breakdown.map((item) => (
                  <div key={item.stars} className="flex items-center gap-3">
                    <span className="w-4 text-sm font-semibold">{item.stars}</span>
                    <Star size={12} className="fill-amber-400 text-amber-400" />
                    <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-muted">
                      <div
                        className={`h-full rounded-full transition-all ${
                          item.stars >= 4
                            ? "bg-emerald-500"
                            : item.stars === 3
                              ? "bg-amber-500"
                              : "bg-rose-500"
                        }`}
                        style={{ width: `${item.percent}%` }}
                      />
                    </div>
                    <span className="w-8 text-sm font-medium text-muted-foreground">{item.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Quick Stats */}
          <Card className="lg:col-span-2 bg-white">
            <CardHeader className="pb-4">
              <div>
                <CardTitle className="text-base font-semibold">This month</CardTitle>
                <CardDescription className="mt-1">Counted from the reviews below</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {/* These three were hardcoded to +12, 92% and 100%: a salon with two
                  one-star reviews and no replies was shown a perfect month. They are
                  counted from the reviews on screen now. */}
              <div className="grid grid-cols-3 gap-4">
                <StatCard icon={TrendingUp} label="New this month" value={newThisMonth} tone="emerald" />
                <StatCard
                  icon={ThumbsUp}
                  label="Positive"
                  value={reviews.length ? `${positivePercent}%` : "—"}
                  hint="4 stars or more"
                  tone="sky"
                />
                <StatCard
                  icon={MessageSquare}
                  label="Replied"
                  value={reviews.length ? `${repliedPercent}%` : "—"}
                  tone="violet"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Recent Reviews */}
        <Card className="bg-white">
          <CardHeader className="pb-4">
            <div>
              <CardTitle className="text-base font-semibold">Recent reviews</CardTitle>
              <CardDescription className="mt-1">Newest first · reply to answer publicly</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground">Loading reviews…</p>
              ) : reviews.length === 0 ? (
                <EmptyState
                  icon={Star}
                  title="No reviews yet"
                  body="A customer can review a visit once it is done. Ask the people who have already been, using the button above."
                />
              ) : null}
              {reviews.map((review, index) => (
                <div
                  key={review.id}
                  // A card per review, with the score carried in colour: a page of
                  // identical grey paragraphs gives no clue which one needs answering.
                  className={`rounded-xl border-l-4 bg-white p-4 shadow-sm ${
                    review.rating >= 4
                      ? "border-l-emerald-500"
                      : review.rating === 3
                        ? "border-l-amber-500"
                        : "border-l-rose-500"
                  }`}
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Avatar className="ring-2 ring-background">
                        <AvatarFallback
                          className={`font-semibold ${clientColorClasses(review.authorName || "customer")}`}
                        >
                          {(review.authorName || "C").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="min-w-0">
                        {/* The API carries the reviewer's first name now (user_id was
                            never recorded before, so nobody could be named). */}
                        <p className="truncate text-sm font-semibold">{review.authorName || "A customer"}</p>
                        <p className="text-xs text-muted-foreground">
                          {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ""}
                          {review.staffId ? ` · Staff #${review.staffId}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          review.rating >= 4
                            ? "bg-emerald-100 text-emerald-800"
                            : review.rating === 3
                              ? "bg-amber-100 text-amber-800"
                              : "bg-rose-100 text-rose-800"
                        }`}
                      >
                        {review.rating.toFixed(1)}
                      </span>
                      <StarRating rating={review.rating} />
                    </div>
                  </div>
                  {/* A review nobody has answered is the one thing this page is for. */}
                  {!review.reply && review.rating <= 3 && replyingTo !== review.id && (
                    <p className="mb-2 inline-block rounded-full bg-rose-50 px-2.5 py-1 text-xs font-medium text-rose-700">
                      Needs a reply
                    </p>
                  )}
                  <p className="mb-3 text-sm leading-relaxed">
                    {review.comment || (
                      <span className="italic text-muted-foreground">Rating only, no comment</span>
                    )}
                  </p>
                  {/* Answering a review in public is how a bad one stops being the last
                      word on it. The button did nothing until now. */}
                  {review.reply && replyingTo !== review.id ? (
                    <div className="rounded-lg border border-violet-200 bg-violet-50 p-3">
                      <p className="mb-1 text-xs font-semibold text-violet-900">Your reply</p>
                      <p className="text-sm text-muted-foreground leading-relaxed">{review.reply}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-7 px-2 text-xs"
                        onClick={() => { setReplyingTo(review.id); setReplyText(review.reply ?? ""); }}
                      >
                        Edit reply
                      </Button>
                    </div>
                  ) : replyingTo === review.id ? (
                    <div className="space-y-2">
                      <Textarea
                        value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder="Reply publicly to this review…"
                        rows={3}
                      />
                      <div className="flex items-center gap-2">
                        <Button size="sm" disabled={savingReply} onClick={() => void saveReply(review.id)}>
                          {savingReply ? "Saving…" : "Post reply"}
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setReplyingTo(null)}>
                          Cancel
                        </Button>
                        {review.reply ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            disabled={savingReply}
                            onClick={() => void saveReply(review.id, "")}
                          >
                            Remove reply
                          </Button>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 border-border/60 hover:border-accent/30 hover:bg-accent/5 transition-all"
                      onClick={() => { setReplyingTo(review.id); setReplyText(""); }}
                    >
                      <Reply size={14} />
                      Reply
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}



























