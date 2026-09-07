import { apiClient } from "@/config/api";

/**
 * #25: ReviewController and ReviewService have existed on the backend all along; the
 * Reviews page rendered hardcoded demo reviews with invented client names and an
 * invented 4.8 average. Nothing on the client had ever called the real endpoints.
 */
export interface Review {
  id: number;
  businessId: number;
  userId: number | null;
  staffId: number | null;
  appointmentId: number | null;
  rating: number;
  comment: string | null;
  createdAt: string;
  /** The reviewer's first name. Null on reviews left before user_id was recorded. */
  authorName: string | null;
  /** The salon's public answer, and when it was posted. Null until they reply. */
  reply: string | null;
  repliedAt: string | null;
}

export interface ReviewRequestPreview {
  count: number;
  windowDays: number;
  clients: { clientName: string; serviceName: string; appointmentDate: string }[];
}

/** What GET /reviews/business/{id}/summary returns — count and average, nothing more. */
export interface RatingSummary {
  count: number;
  average: number | null;
}

class ReviewService {
  async getByBusiness(businessId: number): Promise<Review[]> {
    return apiClient.get<Review[]>(`/reviews/business/${businessId}`);
  }

  async getSummary(businessId: number): Promise<RatingSummary> {
    return apiClient.get<RatingSummary>(`/reviews/business/${businessId}/summary`);
  }

  /** Post or clear the salon's public answer. An empty string removes it. */
  async reply(businessId: number, reviewId: number, reply: string): Promise<Review> {
    return apiClient.put<Review>(`/reviews/business/${businessId}/${reviewId}/reply`, { reply });
  }

  /** Who would be asked to review, so the count is visible before anything is sent. */
  async requestPreview(businessId: number): Promise<ReviewRequestPreview> {
    return apiClient.get<ReviewRequestPreview>(`/reviews/request/business/${businessId}`);
  }

  async sendRequests(businessId: number): Promise<{ requested: number; skipped: number }> {
    return apiClient.post<{ requested: number; skipped: number }>(
      `/reviews/request/business/${businessId}`,
      {}
    );
  }
}

export const reviewService = new ReviewService();

/**
 * Star distribution, computed here because the API returns only count and average.
 * Percentages are of the total, so an empty list yields all zeros rather than NaN.
 */
export function ratingBreakdown(reviews: Review[]) {
  const total = reviews.length;
  return [5, 4, 3, 2, 1].map((stars) => {
    const count = reviews.filter((r) => r.rating === stars).length;
    return { stars, count, percent: total > 0 ? Math.round((count / total) * 100) : 0 };
  });
}
