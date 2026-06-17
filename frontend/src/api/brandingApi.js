// FILE: /frontend/src/api/brandingApi.js
// Public branding lookup — resolves white-label partner theme from the host.

import client from './client';

export const brandingApi = {
  // Resolves branding for the current host (server reads Host header).
  get: () => client.get('/branding').then((r) => r.data),
};
