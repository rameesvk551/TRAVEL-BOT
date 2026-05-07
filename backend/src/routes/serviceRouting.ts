const { Router } = require('express');
const { z } = require('zod');
const authenticate = require('../middleware/authenticate');
const requireRole = require('../middleware/requireRole');
const requirePermission = require('../middleware/requirePermission');
const validateBody = require('../middleware/validateBody');
const serviceRoutingController = require('../controllers/serviceRoutingController');
const { PERMISSIONS } = require('../constants/permissions');

const router = Router();

const replaceRoutingSchema = z.object({
  rules: z.array(z.object({
    intentKey: z.string().min(1).max(80),
    agentId: z.string().uuid(),
    priority: z.number().int().optional(),
    isActive: z.boolean().optional(),
  })).max(50),
});

router.get(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.USERS_MANAGE),
  serviceRoutingController.list
);

router.put(
  '/',
  authenticate,
  requireRole('ADMIN'),
  requirePermission(PERMISSIONS.USERS_MANAGE),
  validateBody(replaceRoutingSchema),
  serviceRoutingController.replace
);

module.exports = router;
