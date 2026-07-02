// FILE: /backend/src/routes/calls.js
// DEPS: zod

const { Router } = require('express');
const { z } = require('zod');
const callController = require('../controllers/callController');
const authenticate = require('../middleware/authenticate');
const requirePermission = require('../middleware/requirePermission');
const validateBody = require('../middleware/validateBody');
const { PERMISSIONS } = require('../constants/permissions');

const router = Router();

const startCallSchema = z.object({
  leadId: z.string().uuid(),
});

router.get('/', authenticate, requirePermission(PERMISSIONS.LEADS_VIEW), callController.list);
router.post('/start', authenticate, requirePermission(PERMISSIONS.LEADS_MANAGE), validateBody(startCallSchema), callController.start);
// Streams a call recording, proxied with Twilio Basic Auth and scoped to the
// requester's agency. Browsers can't open the raw api.twilio.com URL directly.
router.get('/:id/recording', authenticate, requirePermission(PERMISSIONS.LEADS_VIEW), callController.recording);

// Twilio callbacks. These are public endpoints and are verified with the
// X-Twilio-Signature header in callService when TWILIO_AUTH_TOKEN is set.
router.post('/twiml/connect', callController.connectTwiml);
router.post('/twiml/inbound', callController.inboundTwiml);
router.post('/webhooks/status', callController.statusWebhook);
router.post('/webhooks/recording', callController.recordingWebhook);

module.exports = router;
