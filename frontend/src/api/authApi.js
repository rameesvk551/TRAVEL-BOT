// FILE: /frontend/src/api/authApi.js

import client from './client';

export const authApi = {
  register: (data) => client.post('/auth/register', data).then((r) => r.data),
  login: (data) => client.post('/auth/login', data).then((r) => r.data),
  refresh: (refreshToken) => client.post('/auth/refresh', { refreshToken }).then((r) => r.data),
  logout: (refreshToken) => client.post('/auth/logout', { refreshToken }).then((r) => r.data),
  me: () => client.get('/auth/me').then((r) => r.data),
};
