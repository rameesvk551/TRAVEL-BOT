import client from './client';

export const servicesApi = {
  list: (params) => client.get('/services', { params }).then((r) => r.data),
  getById: (id) => client.get(`/services/${id}`).then((r) => r.data),
  create: (data) => client.post('/services', data).then((r) => r.data),
  update: (id, data) => client.patch(`/services/${id}`, data).then((r) => r.data),
  delete: (id) => client.delete(`/services/${id}`).then((r) => r.data),
  reorder: (orderedIds) => client.patch('/services/reorder', { orderedIds }).then((r) => r.data),
};
