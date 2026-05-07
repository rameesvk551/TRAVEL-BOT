import client from './client';

export const serviceRoutingApi = {
  get: () => client.get('/service-routing').then((r) => r.data),
  replace: (rules) => client.put('/service-routing', { rules }).then((r) => r.data),
};
