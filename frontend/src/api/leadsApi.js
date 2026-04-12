// FILE: /frontend/src/api/leadsApi.js

import client from './client';

export const leadsApi = {
  list: (params) => client.get('/leads', { params }).then((r) => r.data),
  getById: (id) => client.get(`/leads/${id}`).then((r) => r.data),
  create: (data) => client.post('/leads', data).then((r) => r.data),
  update: (id, data) => client.patch(`/leads/${id}`, data).then((r) => r.data),
  delete: (id) => client.delete(`/leads/${id}`).then((r) => r.data),
};
