// FILE: /backend/src/routes/ads.ts
// DEPS: express, zod

import { Router } from 'express';
import { z } from 'zod';
import * as adsController from '../controllers/adsController';
import authenticate from '../middleware/authenticate';
import requirePermission from '../middleware/requirePermission';
import validateBody from '../middleware/validateBody';
import { PERMISSIONS } from '../constants/permissions';

const router = Router();

const createAdSchema = z.object({
  headline: z.string().min(1, 'Headline required'),
  primaryText: z.string().min(1, 'Primary text required'),
  budget: z.number().min(100, 'Minimum budget is 100'),
  mediaUrl: z.string().url('Must be a valid media URL').optional(),
});

/**
 * POST /api/ads - Proxies ad creation request to Marketing OS Meta layer
 */
router.post(
  '/',
  authenticate,
  requirePermission(PERMISSIONS.AGENCY_MANAGE), 
  validateBody(createAdSchema),
  adsController.createClickToWhatsAppAd
);

export default router;
