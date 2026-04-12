// FILE: /frontend/src/api/analyticsApi.js

import client from './client';

export const analyticsApi = {
  getSummary: () => client.get('/analytics/summary').then((r) => r.data),
};
