import client from './client';

export const adsApi = {
  connect: (data = {}) => client.post('/ads/connect', data).then((r) => r.data),
  accounts: () => client.get('/ads/accounts').then((r) => r.data),
  campaigns: (params = {}) => client.get('/ads/campaigns', { params }).then((r) => r.data),
  campaign: (campaignId) => client.get(`/ads/campaigns/${encodeURIComponent(campaignId)}`).then((r) => r.data),
  campaignInsights: (campaignId, params = {}) =>
    client.get(`/ads/campaigns/${encodeURIComponent(campaignId)}/insights`, { params }).then((r) => r.data),
  forms: (params = {}) => client.get('/ads/forms', { params }).then((r) => r.data),
  backfillForm: (formId, data = {}) =>
    client.post(`/ads/forms/${encodeURIComponent(formId)}/backfill`, data).then((r) => r.data),
};
