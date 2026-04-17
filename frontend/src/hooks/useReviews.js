// FILE: /frontend/src/hooks/useReviews.js
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { reviewsApi } from '../api/reviewsApi';

export function useReviews(params = {}) {
  return useQuery({
    queryKey: ['reviews', params],
    queryFn: () => reviewsApi.list(params),
  });
}

export function useReviewStats() {
  return useQuery({
    queryKey: ['reviewStats'],
    queryFn: () => reviewsApi.stats(),
  });
}

export function useToggleReviewPublished() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => reviewsApi.togglePublished(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['reviews'] });
      qc.invalidateQueries({ queryKey: ['reviewStats'] });
    },
  });
}
