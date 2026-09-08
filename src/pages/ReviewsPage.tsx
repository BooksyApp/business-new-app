import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
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
        subtitle="Monitor and respond to client feedback"
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
                ? `Request Reviews (${requestCount})`
                : "Request Reviews"}
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Enhanced Stats Overview */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Enhanced Rating Summary */}
          <Card className="lg:col-span-1 bg-white">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold">Overall Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-6">
                <span className="text-5xl font-bold bg-gradient-to-br from-accent to-purple-600 bg-clip-text text-transparent">
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
                    <span className="text-sm font-semibold w-4">{item.stars}</span>
                    <Star size={12} className="fill-appointment-yellow text-appointment-yellow" />
                    <Progress value={item.percent} className="flex-1 h-2.5" />
                    <span className="text-sm text-muted-foreground font-medium w-8">{item.count}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Quick Stats */}
          <Card className="lg:col-span-2 bg-white">
            <CardHeader className="pb-4">
              <div>
                <CardTitle className="text-lg font-bold">Review Insights</CardTitle>
                <CardDescription className="mt-1">Performance trends this month</CardDescription>
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
              <CardTitle className="text-lg font-bold">Recent Reviews</CardTitle>
              <CardDescription className="mt-1">Latest feedback from your clients</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
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
                  className="border-b border-border/60 pb-6 last:border-0 last:pb-0"
                  style={{ animationDelay: `${index * 30}ms` }}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <Avatar className="ring-2 ring-background">
                        <AvatarFallback className="bg-gradient-to-br from-accent/20 to-purple-600/20 text-foreground font-semibold">
                          {(review.authorName || "C").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        {/* The API carries the reviewer's first name now (user_id was
                            never recorded before, so nobody could be named). */}
                        <p className="font-semibold text-sm">{review.authorName || "A customer"}</p>
                        <p className="text-xs text-muted-foreground font-medium">
                          {review.staffId ? `Staff #${review.staffId}` : "No staff recorded"}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <StarRating rating={review.rating} />
                      <p className="text-xs text-muted-foreground font-medium mt-1">
                        {review.createdAt ? new Date(review.createdAt).toLocaleDateString() : ""}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-3">
                    {review.comment || <span className="italic">Rating only, no comment</span>}
                  </p>
                  {/* Answering a review in public is how a bad one stops being the last
                      word on it. The button did nothing until now. */}
                  {review.reply && replyingTo !== review.id ? (
                    <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
                      <p className="text-xs font-semibold text-foreground mb-1">Your reply</p>
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



























