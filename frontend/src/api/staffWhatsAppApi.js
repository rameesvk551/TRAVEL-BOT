import client from './client';

export const staffWhatsAppApi = {
  listChannels: () => client.get('/agencies/me/staff-whatsapp/channels').then((r) => r.data),
  createConnectSession: (data) => client.post('/agencies/me/staff-whatsapp/connect', data || {}).then((r) => r.data),
  completeConnectSession: (data) => client.post('/agencies/me/staff-whatsapp/complete', data).then((r) => r.data),
  updateChannel: (channelId, data) => client.patch(`/agencies/me/staff-whatsapp/channels/${channelId}`, data).then((r) => r.data),
  deleteChannel: (channelId) => client.delete(`/agencies/me/staff-whatsapp/channels/${channelId}`).then((r) => r.data),
};
