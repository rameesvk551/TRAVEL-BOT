// FILE: /frontend/src/api/dripsApi.js
import client from './client';

export const dripsApi = {
  list: () => client.get('/drips').then(r => r.data),
  getById: (id) => client.get(`/drips/${id}`).then(r => r.data),
  create: (data) => client.post('/drips', data).then(r => r.data),
  update: (id, data) => client.patch(`/drips/${id}`, data).then(r => r.data),
  toggle: (id) => client.post(`/drips/${id}/toggle`).then(r => r.data),
  enroll: (id, data) => client.post(`/drips/${id}/enroll`, data).then(r => r.data),
  updateEnrollment: (enrollmentId, status) => client.patch(`/drips/enrollment/${enrollmentId}`, { status }).then(r => r.data),
};
