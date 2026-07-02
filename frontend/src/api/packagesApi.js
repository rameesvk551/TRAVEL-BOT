// FILE: /frontend/src/api/packagesApi.js

import client from './client';

export const packagesApi = {
  list: (params) => client.get('/packages', { params }).then((r) => r.data),
  getById: (id) => client.get(`/packages/${id}`).then((r) => r.data),
  getFinance: (id) => client.get(`/packages/${id}/finance`).then((r) => r.data),
  create: (data) => client.post('/packages', data).then((r) => r.data),
  update: (id, data) => client.patch(`/packages/${id}`, data).then((r) => r.data),
  createVendorCost: (id, data) => client.post(`/packages/${id}/vendor-costs`, data).then((r) => r.data),
  updateVendorCost: (id, costId, data) => client.patch(`/packages/${id}/vendor-costs/${costId}`, data).then((r) => r.data),
  deleteVendorCost: (id, costId) => client.delete(`/packages/${id}/vendor-costs/${costId}`).then((r) => r.data),
  delete: (id) => client.delete(`/packages/${id}`).then((r) => r.data),
  uploadImage: (file) => {
    const formData = new FormData();
    formData.append('image', file, file.name);
    return client.post('/packages/upload-image', formData).then((r) => r.data);
  },
  uploadBrochure: (file) => {
    const formData = new FormData();
    formData.append('brochure', file, file.name);
    return client.post('/packages/upload-brochure', formData).then((r) => r.data);
  },
};
