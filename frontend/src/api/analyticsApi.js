// FILE: /frontend/src/api/analyticsApi.js

import client from './client';

const qs = (params) => {
  const p = new URLSearchParams();
  if (params?.from) p.set('from', params.from);
  if (params?.to) p.set('to', params.to);
  const str = p.toString();
  return str ? `?${str}` : '';
};

export const analyticsApi = {
  getSummary: () => client.get('/analytics/summary').then((r) => r.data),

  getCalling: (params) => {
    const p = new URLSearchParams();
    if (params?.from) p.set('from', params.from);
    if (params?.to) p.set('to', params.to);
    if (params?.agentId && params.agentId !== 'all') p.set('agentId', params.agentId);
    if (params?.leadId && params.leadId !== 'all') p.set('leadId', params.leadId);
    const str = p.toString();
    return client.get(`/analytics/calls${str ? `?${str}` : ''}`).then((r) => r.data);
  },
  getCrm: (params) => client.get(`/analytics/crm${qs(params)}`).then((r) => r.data),
  getSales: (params) => client.get(`/analytics/sales${qs(params)}`).then((r) => r.data),
  getLeadFunnel: (params) => client.get(`/analytics/lead-funnel${qs(params)}`).then((r) => r.data),
  getAgentPerformance: (params) => client.get(`/analytics/agent-performance${qs(params)}`).then((r) => r.data),
  getPackages: (params) => client.get(`/analytics/packages${qs(params)}`).then((r) => r.data),
  getLostLeads: (params) => client.get(`/analytics/lost-leads${qs(params)}`).then((r) => r.data),
  getResponse: (params) => client.get(`/analytics/response${qs(params)}`).then((r) => r.data),
  getReviews: (params) => client.get(`/analytics/reviews${qs(params)}`).then((r) => r.data),
  getSeasonal: () => client.get('/analytics/seasonal').then((r) => r.data),
  getProfit: (params) => client.get(`/analytics/profit${qs(params)}`).then((r) => r.data),
  getSources: (params) => client.get(`/analytics/sources${qs(params)}`).then((r) => r.data),
  getLeadsByAd: (params) => client.get(`/analytics/leads-by-ad${qs(params)}`).then((r) => r.data),
  getBookings: (params) => client.get(`/analytics/bookings${qs(params)}`).then((r) => r.data),
  getCustomerLtv: (params) => client.get(`/analytics/customer-ltv${qs(params)}`).then((r) => r.data),
  getCac: (params) => client.get(`/analytics/cac${qs(params)}`).then((r) => r.data),
  getOperational: (params) => client.get(`/analytics/operational${qs(params)}`).then((r) => r.data),
  getCampaignRoi: (params) => client.get(`/analytics/campaign-roi${qs(params)}`).then((r) => r.data),
  getGrowth: (params) => client.get(`/analytics/growth${qs(params)}`).then((r) => r.data),
  getLeadHeatmap: (params) => client.get(`/analytics/lead-heatmap${qs(params)}`).then((r) => r.data),

  exportCsv: (type, params) => {
    const p = new URLSearchParams({ type });
    if (params?.from) p.set('from', params.from);
    if (params?.to) p.set('to', params.to);
    return client.get(`/analytics/export?${p.toString()}`, { responseType: 'blob' }).then((r) => r.data);
  },
};
