// FILE: /frontend/src/api/propertiesApi.js

import client from './client';

export const propertiesApi = {
  list: (params) => client.get('/properties', { params }).then((r) => r.data),
  getById: (id) => client.get(`/properties/${id}`).then((r) => r.data),
  create: (data) => client.post('/properties', data).then((r) => r.data),
  update: (id, data) => client.patch(`/properties/${id}`, data).then((r) => r.data),
  delete: (id) => client.delete(`/properties/${id}`).then((r) => r.data),
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('image', file, file.name);
    return client.post('/properties/upload-image', formData).then((r) => r.data);
  },
  uploadBrochure: (file) => {
    const formData = new FormData();
    formData.append('file', file, file.name);
    return client.post('/uploads/pdf', formData).then((r) => r.data);
  },
};
