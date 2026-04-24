import client from './client';

export const flowsApi = {
  list: (params) => client.get('/flows', { params }).then((r) => r.data),
  getById: (id) => client.get(`/flows/${id}`).then((r) => r.data),
  create: (data) => client.post('/flows', data).then((r) => r.data),
  update: (id, data) => client.patch(`/flows/${id}`, data).then((r) => r.data),
  delete: (id) => client.delete(`/flows/${id}`).then((r) => r.data),
  publish: (id) => client.post(`/flows/${id}/publish`).then((r) => r.data),
  sync: () => client.post('/flows/sync').then((r) => r.data),
};
