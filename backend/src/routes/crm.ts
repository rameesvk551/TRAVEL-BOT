// FILE: /backend/src/routes/crm.ts

const { Router } = require('express');
const crmController = require('../controllers/crmController');
const authenticate = require('../middleware/authenticate');
const requirePermission = require('../middleware/requirePermission');
const { PERMISSIONS } = require('../constants/permissions');

const router = Router();
// Agents who can view leads also need access to the stage list so the Leads
// page can render and change statuses without requiring analytics permission.
const canView = [authenticate, requirePermission(PERMISSIONS.LEADS_VIEW)];
const canManage = [authenticate, requirePermission(PERMISSIONS.AGENCY_MANAGE)];

/**
 * Configurable CRM sales-pipeline stages.
 * GET    /api/crm/pipeline-stages        - list (auto-seeds defaults)
 * POST   /api/crm/pipeline-stages        - create
 * PUT    /api/crm/pipeline-stages/reorder - persist new ordering
 * PUT    /api/crm/pipeline-stages/:id     - update
 * DELETE /api/crm/pipeline-stages/:id     - delete
 */
router.get('/pipeline-stages', ...canView, crmController.listStages);
router.post('/pipeline-stages', ...canManage, crmController.createStage);
router.put('/pipeline-stages/reorder', ...canManage, crmController.reorderStages);
router.put('/pipeline-stages/:id', ...canManage, crmController.updateStage);
router.delete('/pipeline-stages/:id', ...canManage, crmController.deleteStage);

module.exports = router;
