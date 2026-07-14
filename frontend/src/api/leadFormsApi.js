import client from './client';

// Named public lead forms (/api/lead-forms). Each form has its own slug + fields
// and is reachable at /lead/:agencyKey/:slug (the default one also at /lead/:agencyKey).
export const leadFormsApi = {
  list: () => client.get('/lead-forms').then((r) => r.data),
  get: (id) => client.get(`/lead-forms/${id}`).then((r) => r.data),
  create: (data) => client.post('/lead-forms', data).then((r) => r.data),
  update: (id, data) => client.put(`/lead-forms/${id}`, data).then((r) => r.data),
  remove: (id) => client.delete(`/lead-forms/${id}`).then((r) => r.data),
};

export default leadFormsApi;
