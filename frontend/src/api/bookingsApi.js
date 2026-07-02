// FILE: /frontend/src/api/bookingsApi.js

import client from './client';

export const bookingsApi = {
  list: (params) => client.get('/bookings', { params }).then((r) => r.data),
  getById: (id) => client.get(`/bookings/${id}`).then((r) => r.data),
  create: (data) => client.post('/bookings', data).then((r) => r.data),
  update: (id, data) => client.patch(`/bookings/${id}`, data).then((r) => r.data),
  getTimeline: (id) => client.get(`/bookings/${id}/timeline`).then((r) => r.data),
  downloadInvoice: (id) => client.get(`/bookings/${id}/invoice`, { responseType: 'blob' }),
};
