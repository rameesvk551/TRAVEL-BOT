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
  overview: () => platformClient.get('/platform/overview').then((r) => r.data),
  agencies: (params) => platformClient.get(withParams('/platform/agencies', params)).then((r) => r.data),
  agency: (id) => platformClient.get(`/platform/agencies/${id}`).then((r) => r.data),
  updateAgencyStatus: (id, isActive) => platformClient.patch(`/platform/agencies/${id}/status`, { isActive }).then((r) => r.data),
  health: () => platformClient.get('/platform/health').then((r) => r.data),
  activity: () => platformClient.get('/platform/activity').then((r) => r.data),
};
