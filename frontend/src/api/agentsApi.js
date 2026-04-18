// FILE: /frontend/src/api/agentsApi.js

import client from './client';

export const agentsApi = {
  list: () => client.get('/agents').then((r) => r.data),
  create: (data) => client.post('/agents', data).then((r) => r.data),
  update: (id, data) => client.patch(`/agents/${id}`, data).then((r) => r.data),
  updateStatus: (data) => client.patch('/agents/me/status', data).then((r) => r.data),
  permissions: () => client.get('/agents/permissions').then((r) => r.data),
};