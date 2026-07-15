// FILE: /frontend/src/api/catalogMediaLinksApi.js
//
// Reel→catalog-item mappings, authored on the Property/Package forms. The reel list itself
// comes from instagramApi.getMedia (marketing-os backed).

import client from './client';

export const catalogMediaLinksApi = {
  list: (params) => client.get('/catalog-media-links', { params }).then((r) => r.data),
  create: (data) => client.post('/catalog-media-links', data).then((r) => r.data),
  update: (id, data) => client.patch(`/catalog-media-links/${id}`, data).then((r) => r.data),
  delete: (id) => client.delete(`/catalog-media-links/${id}`).then((r) => r.data),
};
