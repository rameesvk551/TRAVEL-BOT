import client from './client';

export const itinerariesApi = {
  list: (params) => client.get('/itineraries', { params }).then((r) => r.data),
  getById: (id) => client.get(`/itineraries/${id}`).then((r) => r.data),
  create: (data) => client.post('/itineraries', data).then((r) => r.data),
  update: (id, data) => client.patch(`/itineraries/${id}`, data).then((r) => r.data),
  delete: (id) => client.delete(`/itineraries/${id}`).then((r) => r.data),
};
