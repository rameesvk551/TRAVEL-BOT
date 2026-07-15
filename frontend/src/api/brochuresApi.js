import client from './client';

export const brochuresApi = {
  meta: () => client.get('/brochures/meta').then((r) => r.data),

  list: () => client.get('/brochures').then((r) => r.data),
  getById: (id) => client.get(`/brochures/${id}`).then((r) => r.data),
  create: (data) => client.post('/brochures', data).then((r) => r.data),
  update: (id, data) => client.put(`/brochures/${id}`, data).then((r) => r.data),
  delete: (id) => client.delete(`/brochures/${id}`).then((r) => r.data),

  /** All ten shipped designs, built live against this agency's own photos. */
  previewPresets: (params) =>
    client.get('/brochures/presets/preview', { params }).then((r) => r.data),

  /** Recolour / re-typeset the whole deck in one call. */
  retheme: (id, theme) => client.put(`/brochures/${id}/theme`, { theme }).then((r) => r.data),

  /**
   * The logo. Reuses the existing company-asset endpoint rather than adding another
   * upload path — it already stores to Cloudinary and returns a public URL.
   */
  uploadLogo: (file) => {
    const form = new FormData();
    form.append('image', file);
    return client
      .post('/agencies/me/upload-asset', form, { headers: { 'Content-Type': 'multipart/form-data' } })
      .then((r) => r.data);
  },

  applyTemplate: (id, templateId) =>
    client.post(`/brochures/${id}/template`, { templateId }).then((r) => r.data),
  saveAsTemplate: (id, name) =>
    client.post(`/brochures/${id}/save-as-template`, { name }).then((r) => r.data),
  render: (id) => client.post(`/brochures/${id}/render`).then((r) => r.data),
  send: (id, leadId) => client.post(`/brochures/${id}/send`, { leadId }).then((r) => r.data),

  listTemplates: () => client.get('/brochures/templates').then((r) => r.data),
  deleteTemplate: (templateId) =>
    client.delete(`/brochures/templates/${templateId}`).then((r) => r.data),

  listAssets: (brochureId) =>
    client.get('/brochures/assets', { params: brochureId ? { brochureId } : {} }).then((r) => r.data),

  /**
   * Bulk photo upload. A resort drop is 10-30 files, so this is one multipart
   * request with an `images` array rather than N single-file posts.
   */
  uploadAssets: (files, brochureId, onProgress) => {
    const form = new FormData();
    Array.from(files).forEach((file) => form.append('images', file));
    if (brochureId) form.append('brochureId', brochureId);

    return client
      .post('/brochures/assets', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          if (onProgress && event.total) {
            onProgress(Math.round((event.loaded / event.total) * 100));
          }
        },
      })
      .then((r) => r.data);
  },

  reorderAssets: (ids) => client.put('/brochures/assets/order', { ids }).then((r) => r.data),
  deleteAsset: (assetId) => client.delete(`/brochures/assets/${assetId}`).then((r) => r.data),

  /**
   * Fetch the rendered PDF as a Blob.
   *
   * It has to go through axios rather than a plain <a href> or window.open: the API
   * authenticates on an `Authorization: Bearer` header, which a raw browser navigation
   * does not send, so a direct link would just 401. Same approach as
   * itinerariesApi.downloadPdf.
   */
  downloadPdf: (id) =>
    client.get(`/brochures/${id}/pdf`, { responseType: 'blob' }).then((r) => r.data),
};

/** Fetch the PDF and hand it to the browser as a download. */
export async function downloadBrochurePdf(id, title) {
  const blob = await brochuresApi.downloadPdf(id);
  const url = URL.createObjectURL(blob);
  try {
    const link = document.createElement('a');
    link.href = url;
    link.download = `${String(title || 'brochure').replace(/[^a-z0-9]+/gi, '-')}.pdf`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  } finally {
    // Revoke on the next tick — revoking synchronously can cancel the click in Safari.
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }
}
