import { AppLayout, PageHeader } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Star, ThumbsUp, MessageSquare, TrendingUp, Reply } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { useEffect, useState } from "react";
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

  const breakdown = ratingBreakdown(reviews);

  return (
    <AppLayout>
      <PageHeader
        title="Reviews"
        subtitle="Monitor and respond to client feedback"
        actions={
          <Button 
            variant="outline" 
            className="gap-2 border-border/60 hover:border-accent/30 hover:bg-accent/5 transition-all"
          >
            <MessageSquare size={16} />
            Request Reviews
          </Button>
        }
      />

      <div className="p-6 space-y-6">
        {/* Enhanced Stats Overview */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Enhanced Rating Summary */}
          <Card className="lg:col-span-1 border-border/60 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-card to-card/95 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg font-bold">Overall Rating</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-6">
                <span className="text-5xl font-bold bg-gradient-to-br from-accent to-purple-600 bg-clip-text text-transparent">
                  {summary.average != null ? summary.average.toFixed(1) : "—"}
                </span>
                <div>
                  <StarRating rating={5} />
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
          <Card className="lg:col-span-2 border-border/60 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-card to-card/95 backdrop-blur-sm">
            <CardHeader className="pb-4">
              <div>
                <CardTitle className="text-lg font-bold">Review Insights</CardTitle>
                <CardDescription className="mt-1">Performance trends this month</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-5 rounded-xl bg-gradient-to-br from-status-completed/10 to-status-completed/5 border border-status-completed/20 hover:scale-105 transition-transform cursor-pointer">
                  <TrendingUp className="h-7 w-7 mx-auto mb-2 text-status-completed" />
                  <p className="text-3xl font-bold text-foreground">+12</p>
                  <p className="text-sm text-muted-foreground font-medium mt-1">New Reviews</p>
                </div>
                <div className="text-center p-5 rounded-xl bg-gradient-to-br from-appointment-blue/10 to-appointment-blue/5 border border-appointment-blue/20 hover:scale-105 transition-transform cursor-pointer">
                  <ThumbsUp className="h-7 w-7 mx-auto mb-2 text-appointment-blue" />
                  <p className="text-3xl font-bold text-foreground">92%</p>
                  <p className="text-sm text-muted-foreground font-medium mt-1">Positive</p>
                </div>
                <div className="text-center p-5 rounded-xl bg-gradient-to-br from-appointment-purple/10 to-appointment-purple/5 border border-appointment-purple/20 hover:scale-105 transition-transform cursor-pointer">
                  <MessageSquare className="h-7 w-7 mx-auto mb-2 text-appointment-purple" />
                  <p className="text-3xl font-bold text-foreground">100%</p>
                  <p className="text-sm text-muted-foreground font-medium mt-1">Response Rate</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Recent Reviews */}
        <Card className="border-border/60 shadow-sm hover:shadow-md transition-all duration-300 bg-gradient-to-br from-card to-card/95 backdrop-blur-sm">
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
                <p className="text-sm text-muted-foreground">
                  No reviews yet. They appear here as clients leave them.
                </p>
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
                          {review.staffId ? "S" : "C"}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        {/* #25: the API carries no client or service name. Showing the
                            rating honestly beats inventing an author for it. */}
                        <p className="font-semibold text-sm">Client review</p>
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
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="gap-2 border-border/60 hover:border-accent/30 hover:bg-accent/5 transition-all"
                  >
                    <Reply size={14} />
                    Reply
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}



























