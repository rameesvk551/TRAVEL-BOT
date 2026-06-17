import platformClient from './platformClient';

function withParams(path, params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, value);
    }
  });
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

export const platformApi = {
  login: (data) => platformClient.post('/platform/auth/login', data).then((r) => r.data),
  logout: (refreshToken) => platformClient.post('/platform/auth/logout', { refreshToken }).then((r) => r.data),
  me: () => platformClient.get('/platform/auth/me').then((r) => r.data),
  overview: (params) => platformClient.get(withParams('/platform/overview', params)).then((r) => r.data),
  agencies: (params) => platformClient.get(withParams('/platform/agencies', params)).then((r) => r.data),
  agency: (id, params) => platformClient.get(withParams(`/platform/agencies/${id}`, params)).then((r) => r.data),
  updateAgencyStatus: (id, isActive) => platformClient.patch(`/platform/agencies/${id}/status`, { isActive }).then((r) => r.data),
  updateAgencyModules: (id, modules) => platformClient.patch(`/platform/agencies/${id}/modules`, { modules }).then((r) => r.data),
  health: () => platformClient.get('/platform/health').then((r) => r.data),
  activity: () => platformClient.get('/platform/activity').then((r) => r.data),

  // ===== White-label partners =====
  partners: () => platformClient.get('/platform/partners').then((r) => r.data),
  partner: (id) => platformClient.get(`/platform/partners/${id}`).then((r) => r.data),
  createPartner: (data) => platformClient.post('/platform/partners', data).then((r) => r.data),
  uploadPartnerAsset: (assetType, file) => {
    const formData = new FormData();
    formData.append('image', file);
    return platformClient
      .post(`/platform/partners/upload-asset?assetType=${encodeURIComponent(assetType)}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((r) => r.data);
  },
  updatePartner: (id, data) => platformClient.patch(`/platform/partners/${id}`, data).then((r) => r.data),
  assignAgency: (id, agencyId) => platformClient.post(`/platform/partners/${id}/agencies`, { agencyId }).then((r) => r.data),
  unassignAgency: (agencyId) => platformClient.delete(`/platform/partners/agencies/${agencyId}`).then((r) => r.data),
  generatePartnerInvoice: (id, period) => platformClient.post(`/platform/partners/${id}/invoices`, period).then((r) => r.data),
  updatePartnerInvoice: (invoiceId, status) => platformClient.patch(`/platform/partners/invoices/${invoiceId}`, { status }).then((r) => r.data),
};
