// FILE: /frontend/src/api/crmApi.js

import client from './client';

export const crmApi = {
  listStages: () => client.get('/crm/pipeline-stages').then((r) => r.data),
  createStage: (body) => client.post('/crm/pipeline-stages', body).then((r) => r.data),
  updateStage: (id, body) => client.put(`/crm/pipeline-stages/${id}`, body).then((r) => r.data),
  deleteStage: (id) => client.delete(`/crm/pipeline-stages/${id}`).then((r) => r.data),
  reorderStages: (orderedIds) => client.put('/crm/pipeline-stages/reorder', { orderedIds }).then((r) => r.data),
};
