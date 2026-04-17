// FILE: /frontend/src/api/templatesApi.js
import client from './client';

export const templatesApi = {
  listPrebuilt: (params) => client.get('/templates/prebuilt', { params }).then(r => r.data),
  usePrebuilt: (id, data) => client.post(`/templates/prebuilt/${id}/use`, data).then(r => r.data),
  
  listAgency: (params) => client.get('/templates', { params }).then(r => r.data),
  getById: (id) => client.get(`/templates/${id}`).then(r => r.data),
  create: (data) => client.post('/templates', data).then(r => r.data),
  update: (id, data) => client.patch(`/templates/${id}`, data).then(r => r.data),
  delete: (id) => client.delete(`/templates/${id}`).then(r => r.data),
  duplicate: (id) => client.post(`/templates/${id}/duplicate`).then(r => r.data),
  submit: (id) => client.post(`/templates/${id}/submit`).then(r => r.data),
};
