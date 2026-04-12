// FILE: /frontend/src/api/paymentsApi.js

import client from './client';

export const paymentsApi = {
  requestPayment: (bookingId) => client.post('/payments/request', { bookingId }).then((r) => r.data),
  getByBooking: (bookingId) => client.get(`/payments/booking/${bookingId}`).then((r) => r.data),
};
