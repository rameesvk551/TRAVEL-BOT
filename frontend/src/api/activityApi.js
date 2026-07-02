import client from './client';

export const activityApi = {
  list: (params) => client.get('/activity', { params }).then((r) => r.data),
  filters: () => client.get('/activity/filters').then((r) => r.data),
};
