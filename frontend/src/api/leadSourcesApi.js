import client from './client';

export const leadSourcesApi = {
  list: () => client.get('/lead-sources'),
  create: (data) => client.post('/lead-sources', data),
  update: (id, data) => client.put(`/lead-sources/${id}`, data),
  delete: (id) => client.delete(`/lead-sources/${id}`),
};
