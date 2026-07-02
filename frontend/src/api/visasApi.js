// FILE: /frontend/src/api/visasApi.js

import client from './client';

export const visasApi = {
  list: (params) => client.get('/visas', { params }).then((r) => r.data),
  getById: (id) => client.get(`/visas/${id}`).then((r) => r.data),
  create: (data) => client.post('/visas', data).then((r) => r.data),
  update: (id, data) => client.patch(`/visas/${id}`, data).then((r) => r.data),
  delete: (id) => client.delete(`/visas/${id}`).then((r) => r.data),
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('image', file, file.name);
    return client.post('/visas/upload-image', formData).then((r) => r.data);
  },
};
