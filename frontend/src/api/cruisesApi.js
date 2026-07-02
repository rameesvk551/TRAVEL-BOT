// FILE: /frontend/src/api/cruisesApi.js

import client from './client';

export const cruisesApi = {
  list: (params) => client.get('/cruises', { params }).then((r) => r.data),
  getById: (id) => client.get(`/cruises/${id}`).then((r) => r.data),
  create: (data) => client.post('/cruises', data).then((r) => r.data),
  update: (id, data) => client.patch(`/cruises/${id}`, data).then((r) => r.data),
  delete: (id) => client.delete(`/cruises/${id}`).then((r) => r.data),
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('image', file, file.name);
    return client.post('/cruises/upload-image', formData).then((r) => r.data);
  },
};
