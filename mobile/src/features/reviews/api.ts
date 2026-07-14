// FILE: mobile/src/features/reviews/api.ts
// Backed by /api/reviews (backend/src/routes/reviews.ts). Only three routes
// exist: GET /reviews, GET /reviews/stats, POST /reviews/:id/toggle-published.
//
// SHAPE CORRECTIONS vs the old mock:
//   - There is no `platform` (Google/Tripadvisor). Reviews are first-party,
//     collected post-trip over WhatsApp. The model carries `destination` instead.
//   - There is no reply/response feature. The one write is publish/unpublish,
//     which approves a testimonial for marketing use.
//   - There is NO GET /reviews/:id. useReview resolves the row out of the list
//     route rather than inventing an endpoint.

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../lib/api';

export interface ReviewCustomer {
  name?: string;
  phone?: string;
}

export interface ReviewBooking {
  bookingRef?: string;
  travelDate?: string;
}

/** Mirrors backend/src/models/Review.ts. */
export interface Review {
  id: string;
  customerId: string;
  bookingId: string | null;
  /** 1-5. */
  rating: number;
  testimonial: string | null;
  destination: string | null;
  /** Approved for marketing use. */
  isPublished: boolean;
  googleReviewSent: boolean;
  createdAt: string;
  updatedAt: string;
  customer?: ReviewCustomer | null;
  booking?: ReviewBooking | null;
}

export interface ReviewStats {
  totalReviews: number;
  publishedCount: number;
  avgRating: number;
  /** Raw SQL group-by: `count` arrives as a string. */
  distribution: Array<{ rating: number; count: string | number }>;
}

export type ReviewFilter = 'ALL' | 'PUBLISHED' | 'UNPUBLISHED';

const PAGE_SIZE = 100;

function filterToParam(filter: ReviewFilter): boolean | undefined {
  if (filter === 'PUBLISHED') return true;
  if (filter === 'UNPUBLISHED') return false;
  return undefined;
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function useReviews(filter: ReviewFilter = 'ALL') {
  return useQuery({
    queryKey: ['reviews', 'list', filter],
    queryFn: async (): Promise<Review[]> => {
      const res = await api.get('/reviews', {
        params: { isPublished: filterToParam(filter), pageSize: PAGE_SIZE },
      });
      return (res.data.data ?? []) as Review[];
    },
  });
}

export function useReviewStats() {
  return useQuery({
    queryKey: ['reviews', 'stats'],
    queryFn: async (): Promise<ReviewStats> => {
      const res = await api.get('/reviews/stats');
      return res.data.data as ReviewStats;
    },
  });
}

/**
 * The backend has no GET /reviews/:id. We pull the (unfiltered) list and select
 * the row, so a deep link still works standalone. Throws when absent so the
 * screen renders ErrorState rather than an empty shell.
 */
export function useReview(id: string) {
  return useQuery({
    queryKey: ['reviews', 'detail', id],
    queryFn: async (): Promise<Review> => {
      const res = await api.get('/reviews', { params: { pageSize: PAGE_SIZE } });
      const rows = (res.data.data ?? []) as Review[];
      const found = rows.find((r) => r.id === id);
      if (!found) throw new Error('Review not found');
      return found;
    },
    enabled: Boolean(id),
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

/** POST /reviews/:id/toggle-published — approves or withdraws a testimonial. */
export function useTogglePublished() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<Review> => {
      const res = await api.post(`/reviews/${id}/toggle-published`);
      return res.data.data as Review;
    },
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: ['reviews'] });
      qc.invalidateQueries({ queryKey: ['reviews', 'detail', id] });
    },
  });
}
