// FILE: /frontend/src/api/campaignsApi.js
import client from './client';

export const campaignsApi = {
  list: (params) => client.get('/campaigns', { params }).then(r => r.data),
  getById: (id) => client.get(`/campaigns/${id}`).then(r => r.data),
  create: (data) => client.post('/campaigns', data).then(r => r.data),
  update: (id, data) => client.patch(`/campaigns/${id}`, data).then(r => r.data),
  send: (id) => client.post(`/campaigns/${id}/send`).then(r => r.data),
  cancel: (id) => client.post(`/campaigns/${id}/cancel`).then(r => r.data),
  previewAudience: (filter) => client.post('/campaigns/preview-audience', filter).then(r => r.data),
};
