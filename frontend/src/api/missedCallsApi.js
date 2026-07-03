import client from './client';

export const missedCallsApi = {
  // Inbound WhatsApp calls (missed-call log). Returns { success, rows, total, limit, offset }.
  list: (params) => client.get('/missed-calls', { params }).then((r) => r.data),
};
