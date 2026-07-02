import client from './client';

export const itinerariesApi = {
  list: (params) => client.get('/itineraries', { params }).then((r) => r.data),
  getById: (id) => client.get(`/itineraries/${id}`).then((r) => r.data),
  create: (data) => client.post('/itineraries', data).then((r) => r.data),
  update: (id, data) => client.patch(`/itineraries/${id}`, data).then((r) => r.data),
  uploadPdf: (id, file) => {
    const formData = new FormData();
    formData.append('pdf', file, file.name);
    return client.post(`/itineraries/${id}/upload-pdf`, formData).then((r) => r.data);
  },
  // Server-rendered themed PDF (returns a Blob).
  downloadPdf: (id) => client.get(`/itineraries/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data),
  sendWhatsApp: (id) => client.post(`/itineraries/${id}/send-whatsapp`).then((r) => r.data),
  delete: (id) => client.delete(`/itineraries/${id}`).then((r) => r.data),
};
