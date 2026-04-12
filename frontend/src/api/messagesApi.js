// FILE: /frontend/src/api/messagesApi.js

import client from './client';

export const messagesApi = {
  list: (customerId, params) => client.get('/messages', { params: { customerId, ...params } }).then((r) => r.data),
  getLive: () => client.get('/messages/live').then((r) => r.data),
  send: (data) => client.post('/messages/send', data).then((r) => r.data),
  takeover: (customerId) => client.patch(`/messages/sessions/${customerId}/takeover`).then((r) => r.data),
};
