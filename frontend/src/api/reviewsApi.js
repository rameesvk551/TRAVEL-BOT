// FILE: /frontend/src/api/reviewsApi.js
import client from './client';

export const reviewsApi = {
  list: (params) => client.get('/reviews', { params }).then(r => r.data),
  stats: () => client.get('/reviews/stats').then(r => r.data),
  togglePublished: (id) => client.post(`/reviews/${id}/toggle-published`).then(r => r.data),
};
