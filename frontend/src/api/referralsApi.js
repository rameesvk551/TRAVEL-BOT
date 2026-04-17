// FILE: /frontend/src/api/referralsApi.js
import client from './client';

export const referralsApi = {
  list: () => client.get('/referrals').then(r => r.data),
  stats: () => client.get('/referrals/stats').then(r => r.data),
  create: (data) => client.post('/referrals', data).then(r => r.data),
  toggle: (id) => client.post(`/referrals/${id}/toggle`).then(r => r.data),
};
