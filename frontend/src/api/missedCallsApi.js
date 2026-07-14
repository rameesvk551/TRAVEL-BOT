import client from './client';

export const missedCallsApi = {
  // Inbound WhatsApp calls (missed-call log). Returns { success, rows, total, limit, offset }.
  list: (params) => client.get('/missed-calls', { params }).then((r) => r.data),
  // Current Meta call-settings for the agency number.
  callingStatus: () => client.get('/missed-calls/calling-status').then((r) => r.data),
  // Turn on WhatsApp voice calling for the agency number.
  enableCalling: () => client.post('/missed-calls/enable-calling').then((r) => r.data),
};
