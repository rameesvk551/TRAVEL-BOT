// FILE: /frontend/src/api/leadsApi.js

import client from './client';

export const leadsApi = {
  list: (params) => client.get('/leads', { params }).then((r) => r.data),
  getById: (id) => client.get(`/leads/${id}`).then((r) => r.data),
  create: (data) => client.post('/leads', data).then((r) => r.data),
  update: (id, data) => client.patch(`/leads/${id}`, data).then((r) => r.data),
  delete: (id) => client.delete(`/leads/${id}`).then((r) => r.data),

  // Follow-ups
  listFollowUps: (params) => client.get('/leads/followups', { params }).then((r) => r.data),
  addFollowUp: (id, data) => client.post(`/leads/${id}/followups`, data).then((r) => r.data),
  updateFollowUp: (id, followUpId, data) => client.patch(`/leads/${id}/followups/${followUpId}`, data).then((r) => r.data),
  deleteFollowUp: (id, followUpId) => client.delete(`/leads/${id}/followups/${followUpId}`).then((r) => r.data),

  // Notes
  addNote: (id, data) => client.post(`/leads/${id}/notes`, data).then((r) => r.data),
};
