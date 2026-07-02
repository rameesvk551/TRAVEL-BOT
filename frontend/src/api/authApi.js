// FILE: /frontend/src/api/authApi.js

import client from './client';

export const authApi = {
  register: (data) => client.post('/auth/register', data).then((r) => r.data),
  login: (data) => client.post('/auth/login', data).then((r) => r.data),
  forgotPassword: (data) => client.post('/auth/forgot-password', data).then((r) => r.data),
  resetPassword: (data) => client.post('/auth/reset-password', data).then((r) => r.data),
  refresh: (refreshToken) => client.post('/auth/refresh', { refreshToken }).then((r) => r.data),
  logout: (refreshToken) => client.post('/auth/logout', { refreshToken }).then((r) => r.data),
  me: () => client.get('/auth/me').then((r) => r.data),
};
