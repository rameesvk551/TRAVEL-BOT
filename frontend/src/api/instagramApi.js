import client from './client';

// ── Instagram Connection (Settings) ──
export const getInstagramConnection = () =>
  client.get('/agencies/me/instagram-connection').then((r) => r.data);

export const connectInstagram = (payload) =>
  client.post('/agencies/me/instagram-connection/connect', payload).then((r) => r.data);

export const disconnectInstagram = (accountId) =>
  client.delete(`/agencies/me/instagram-connection/${encodeURIComponent(accountId)}`).then((r) => r.data);

// ── DM Inbox ──
export const getMessages = (accountId) =>
  client.get('/instagram/messages', { params: { accountId } }).then((r) => r.data);

export const sendMessage = (accountId, recipientId, text) =>
  client.post(`/instagram/messages/${accountId}/send`, { recipientId, text }).then((r) => r.data);

// ── Comments ──
export const getComments = (accountId) =>
  client.get('/instagram/comments', { params: { accountId } }).then((r) => r.data);

export const replyToComment = (accountId, commentId, text) =>
  client.post(`/instagram/comments/${accountId}/${commentId}/reply`, { text }).then((r) => r.data);

export const deleteComment = (accountId, commentId) =>
  client.delete(`/instagram/comments/${accountId}/${commentId}`).then((r) => r.data);

export const sendPrivateReply = (accountId, commentId, payload) =>
  client.post(`/instagram/comments/${accountId}/${commentId}/private-reply`, payload).then((r) => r.data);

// Comment-to-DM Automations
export const getAutomations = (params = {}) =>
  client.get('/instagram/automations', { params }).then((r) => r.data);

export const createAutomation = (payload) =>
  client.post('/instagram/automations', payload).then((r) => r.data);

export const updateAutomation = (automationId, payload) =>
  client.patch(`/instagram/automations/${automationId}`, payload).then((r) => r.data);

export const deleteAutomation = (automationId) =>
  client.delete(`/instagram/automations/${automationId}`).then((r) => r.data);

export const getAutomationLogs = (automationId, params = {}) =>
  client.get(`/instagram/automations/${automationId}/logs`, { params }).then((r) => r.data);

// ── Content Publishing ──
export const publishImage = (payload) =>
  client.post('/instagram/publish', payload).then((r) => r.data);

export const publishCarousel = (payload) =>
  client.post('/instagram/publish/carousel', payload).then((r) => r.data);

export const getMedia = (params = {}) =>
  client.get('/instagram/media', { params }).then((r) => r.data);

// ── Analytics ──
export const getAccountInsights = (accountId, period = 'week') =>
  client.get(`/instagram/analytics/${accountId}`, { params: { period } }).then((r) => r.data);

export const getMediaAnalytics = (accountId, limit = 12) =>
  client.get(`/instagram/analytics/${accountId}/media`, { params: { limit } }).then((r) => r.data);

// ── Profile ──
export const getProfile = (accountId) =>
  client.get(`/instagram/profile/${accountId}`).then((r) => r.data);
