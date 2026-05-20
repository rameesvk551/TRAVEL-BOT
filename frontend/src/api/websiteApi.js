import client from './client';

export function getWebsiteStatus() {
  return client.get('/agencies/me/website').then((response) => response.data.data);
}

export function updateWebsiteSettings(payload) {
  return client.patch('/agencies/me/website', payload).then((response) => response.data.data);
}

export function publishWebsite() {
  return client.post('/agencies/me/website/publish').then((response) => response.data.data);
}

export function unpublishWebsite() {
  return client.post('/agencies/me/website/unpublish').then((response) => response.data.data);
}
