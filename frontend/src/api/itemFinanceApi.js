import client from './client';

export const itemFinanceApi = {
  getReport: (itemType, id) => client.get(`/item-finance/${itemType}/${id}`).then((r) => r.data),
  createVendorCost: (itemType, id, data) => client.post(`/item-finance/${itemType}/${id}/vendor-costs`, data).then((r) => r.data),
  updateVendorCost: (itemType, id, costId, data) => client.patch(`/item-finance/${itemType}/${id}/vendor-costs/${costId}`, data).then((r) => r.data),
  deleteVendorCost: (itemType, id, costId) => client.delete(`/item-finance/${itemType}/${id}/vendor-costs/${costId}`).then((r) => r.data),
};
