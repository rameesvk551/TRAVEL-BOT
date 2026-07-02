import client from './client';

export const callsApi = {
  list: (params) => client.get('/calls', { params }).then((r) => r.data),
  start: (leadId) => client.post('/calls/start', { leadId }).then((r) => r.data),
  // Fetches the recording audio as a Blob (sent with the JWT, unlike a bare
  // <audio src> which can't carry the Authorization header).
  recording: (id) => client.get(`/calls/${id}/recording`, { responseType: 'blob' }).then((r) => r.data),
};
