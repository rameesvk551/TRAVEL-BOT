import client from './client';

export const itineraryTemplatesApi = {
  list: () => client.get('/itinerary-templates').then((r) => r.data),
  getById: (id) => client.get(`/itinerary-templates/${id}`).then((r) => r.data),
  listPresets: () => client.get('/itinerary-templates/presets').then((r) => r.data),
  create: (data) => client.post('/itinerary-templates', data).then((r) => r.data),
  update: (id, data) => client.put(`/itinerary-templates/${id}`, data).then((r) => r.data),
  delete: (id) => client.delete(`/itinerary-templates/${id}`).then((r) => r.data),
};
