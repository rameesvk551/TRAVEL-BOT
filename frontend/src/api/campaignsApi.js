// FILE: /frontend/src/api/campaignsApi.js
import client from './client';

export const campaignsApi = {
  list: (params) => client.get('/campaigns', { params }).then(r => r.data),
  getById: (id) => client.get(`/campaigns/${id}`).then(r => r.data),
  getStats: (id) => client.get(`/campaigns/${id}/stats`).then(r => r.data),
  getReport: (id) => client.get(`/campaigns/${id}/report`).then(r => r.data),
  create: (data) => client.post('/campaigns', data).then(r => r.data),
  update: (id, data) => client.patch(`/campaigns/${id}`, data).then(r => r.data),
  send: (id) => client.post(`/campaigns/${id}/send`).then(r => r.data),
  cancel: (id) => client.post(`/campaigns/${id}/cancel`).then(r => r.data),
  delete: (id) => client.delete(`/campaigns/${id}`).then(r => r.data),
  duplicate: (id) => client.post(`/campaigns/${id}/duplicate`).then(r => r.data),
  previewAudience: (filter) => client.post('/campaigns/preview-audience', filter).then(r => r.data),
  importContacts: (contacts) => client.post('/campaigns/import-contacts', { contacts }).then(r => r.data),
  analytics: (params) => client.get('/campaigns/analytics', { params }).then(r => r.data),
  reports: (params) => client.get('/campaigns/reports', { params }).then(r => r.data),
};
