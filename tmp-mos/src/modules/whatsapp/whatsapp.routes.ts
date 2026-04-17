import { Router, Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { Redis } from 'ioredis';
import {
  WebhookController,
  ConversationController,
  TimelineController,
  TemplateController,
  WhatsAppAnalyticsController,
  AutomationController,
  SettingsController,
  EmbeddedSignupController,
  BroadcastController,
  MetaController,
  AppointmentController,
  CatalogMessageController,
} from './controllers/index.js';
import { getConfig } from '../../config/index.js';

const verifyWebhookChallenge = (req: Request, res: Response) => {
  const config = getConfig();
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === config.whatsapp?.verifyToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
};

const validateWebhookSignature = (_provider: string) =>
  (req: Request, res: Response, next: NextFunction) => {
    const signature = req.header('x-hub-signature-256');
    if (!signature) {
      res.status(401).json({ error: 'Missing webhook signature' });
      return;
    }

    const appSecret = process.env.META_APP_SECRET;
    if (!appSecret) {
      res.status(500).json({ error: 'Webhook signature secret is not configured' });
      return;
    }

    const rawBody = (req as any).rawBody as Buffer | undefined;
    if (!rawBody) {
      res.status(500).json({ error: 'Raw body is required for signature verification' });
      return;
    }

    const expected = `sha256=${crypto
      .createHmac('sha256', appSecret)
      .update(rawBody)
      .digest('hex')}`;

    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(signature);
    if (
      expectedBuffer.length !== receivedBuffer.length ||
      !crypto.timingSafeEqual(expectedBuffer, receivedBuffer)
    ) {
      res.status(401).json({ error: 'Invalid webhook signature' });
      return;
    }

    next();
  };

type LimitBucket = { count: number; resetAt: number };

const createRateLimiter = (limit: number, windowMs: number) => {
  const runtimeConfig = getConfig();
  const isProduction =
    runtimeConfig.server?.nodeEnv === 'production' || process.env.NODE_ENV === 'production';
  const redisUrl = process.env.REDIS_URL;
  const redisClient = redisUrl ? new Redis(redisUrl, { lazyConnect: true }) : null;
  const store = new Map<string, LimitBucket>();

  return async (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();

    if (!redisClient && isProduction) {
      res.status(503).json({ error: 'Rate limiter backend unavailable' });
      return;
    }

    if (redisClient) {
      try {
        if (redisClient.status === 'wait') {
          await redisClient.connect();
        }

        const redisKey = `wa_rl:${key}`;
        const count = await redisClient.incr(redisKey);
        if (count === 1) {
          await redisClient.pexpire(redisKey, windowMs);
        }

        if (count > limit) {
          const ttlMs = await redisClient.pttl(redisKey);
          const retryAfterSeconds = ttlMs > 0 ? Math.ceil(ttlMs / 1000) : Math.ceil(windowMs / 1000);
          res.setHeader('retry-after', String(retryAfterSeconds));
          res.status(429).json({ error: 'Rate limit exceeded' });
          return;
        }

        next();
        return;
      } catch {
        if (isProduction) {
          res.status(503).json({ error: 'Rate limiter backend unavailable' });
          return;
        }
      }
    }

    const bucket = store.get(key);
    if (!bucket || bucket.resetAt <= now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    if (bucket.count >= limit) {
      const retryAfterSeconds = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader('retry-after', String(retryAfterSeconds));
      res.status(429).json({ error: 'Rate limit exceeded' });
      return;
    }

    bucket.count += 1;
    store.set(key, bucket);
    next();
  };
};

const webhookRateLimiter = createRateLimiter(240, 60_000);
const apiRateLimiter = createRateLimiter(600, 60_000);
const sendMessageRateLimiter = createRateLimiter(120, 60_000);

const validateOptIn = (_optInRepo: any) =>
  (_req: Request, _res: Response, next: NextFunction) => next();

const recordImplicitOptIn = (_optInRepo: any) =>
  (_req: Request, _res: Response, next: NextFunction) => next();

export function createWhatsAppRoutes(dependencies: {
  webhookController: WebhookController;
  conversationController: ConversationController;
  timelineController: TimelineController;
  templateController: TemplateController;
  analyticsController: WhatsAppAnalyticsController;
  automationController: AutomationController;
  settingsController: SettingsController;
  embeddedSignupController: EmbeddedSignupController;
  broadcastController: BroadcastController;
  metaController: MetaController;
  appointmentController: AppointmentController;
  catalogMessageController: CatalogMessageController;
  optInRepo: any;
  authMiddleware: (req: any, res: any, next: any) => void;
  tenantMiddleware: (req: any, res: any, next: any) => void;
}): Router {
  const router = Router();
  const {
    webhookController,
    conversationController,
    timelineController,
    templateController,
    analyticsController,
    settingsController,
    embeddedSignupController,
    broadcastController,
    metaController,
    automationController,
    appointmentController,
    catalogMessageController,
    optInRepo,
    authMiddleware,
    tenantMiddleware,
  } = dependencies;

  router.get('/webhook', verifyWebhookChallenge);
  router.get('/webhooks/whatsapp', verifyWebhookChallenge);

  router.post(
    '/webhook',
    webhookRateLimiter,
    validateWebhookSignature('meta'),
    recordImplicitOptIn(optInRepo),
    webhookController.handleWebhook,
  );

  router.post(
    '/webhooks/whatsapp',
    webhookRateLimiter,
    validateWebhookSignature('meta'),
    recordImplicitOptIn(optInRepo),
    webhookController.handleWebhook,
  );

  router.post(
    '/webhook/meta',
    webhookRateLimiter,
    validateWebhookSignature('meta'),
    recordImplicitOptIn(optInRepo),
    webhookController.handleWebhook,
  );

  router.use(authMiddleware);
  router.use(tenantMiddleware);
  router.use(apiRateLimiter);

  router.get('/settings', settingsController.getConnection);
  router.post('/settings/manual', settingsController.saveManualConfig);
  router.put('/settings/manual/:connectionId', settingsController.updateManualConfig);
  router.put('/settings/auto-reply', settingsController.updateAutoReply);
  router.post('/settings/test', settingsController.testConnection);
  router.delete('/settings', settingsController.disconnect);
  router.post('/settings/regenerate-verify-token', settingsController.regenerateVerifyToken);
  router.get('/settings/payment', settingsController.getPaymentSettings);
  router.put('/settings/payment', settingsController.updatePaymentSettings);

  router.get('/settings/embedded/config', embeddedSignupController.getConfig);
  router.post('/settings/embedded/complete', embeddedSignupController.complete);

  router.get('/meta/business-details', metaController.getBusinessDetails);
  router.get('/meta/assets', metaController.getConnectedAssets);

  router.post('/conversations/new', conversationController.startNew);
  router.get('/conversations', conversationController.getConversations);
  router.get('/conversations/:id', conversationController.getConversation);
  router.get('/conversations/:id/messages', conversationController.getMessages);
  router.get('/contacts/segments', conversationController.getSegments);
  router.post('/conversations/:id/link', conversationController.linkEntity);
  router.post('/conversations/:id/assign', conversationController.assignOperator);
  router.put('/conversations/:id/assign', conversationController.assignOperator);
  router.put('/conversations/:id/tags', conversationController.updateTags);
  router.post('/conversations/:id/notes', conversationController.addNote);
  router.post('/conversations/:id/escalate', conversationController.escalate);
  router.post('/conversations/:id/close', conversationController.close);
  router.post('/conversations/:id/send', sendMessageRateLimiter, conversationController.sendMessage);
  router.post(
    '/conversations/:id/send-template',
    sendMessageRateLimiter,
    conversationController.sendConversationTemplate,
  );
  router.post(
    '/conversations/:id/send-interactive',
    sendMessageRateLimiter,
    conversationController.sendInteractive,
  );
  router.post(
    '/conversations/:id/messages/:messageId/payment-link',
    sendMessageRateLimiter,
    conversationController.generatePaymentLink,
  );

  router.get('/automation/rules', automationController.getRules);
  router.post('/automation/rules', automationController.createRule);
  router.put('/automation/rules/:id', automationController.updateRule);
  router.delete('/automation/rules/:id', automationController.deleteRule);
  router.post('/automation/simulate', automationController.simulate);

  router.get('/tickets', conversationController.getEscalated);
  router.post('/tickets/:id/resolve', conversationController.resolveTicket);

  router.get('/appointments', appointmentController.getAppointments);
  router.post('/appointments', appointmentController.createAppointment);
  router.put('/appointments/:id/status', appointmentController.updateStatus);

  router.post('/messages/send', sendMessageRateLimiter, validateOptIn(optInRepo), webhookController.sendMessage);
  router.post('/messages', sendMessageRateLimiter, validateOptIn(optInRepo), webhookController.sendMessageV2);
  router.post('/messages/read-typing', sendMessageRateLimiter, webhookController.sendReadTyping);
  router.post('/messages/media', sendMessageRateLimiter, validateOptIn(optInRepo), webhookController.sendMedia);
  router.post('/messages/interactive', sendMessageRateLimiter, validateOptIn(optInRepo), webhookController.sendInteractive);
  router.post(
    '/messages/template',
    sendMessageRateLimiter,
    validateOptIn(optInRepo),
    webhookController.sendTemplate,
  );
  router.get('/messages/:messageId/status', webhookController.getMessageStatus);

  router.post('/broadcast', broadcastController.send);
  router.get('/broadcast', broadcastController.list);
  router.get('/broadcast/:id', broadcastController.get);

  router.get('/analytics/campaigns', analyticsController.getCampaignStats);
  router.get('/analytics/response-time', analyticsController.getResponseStats);

  router.get('/templates/categories', templateController.getCategories);
  router.get('/templates/triggers', templateController.getTriggers);
  router.get('/templates', templateController.list);
  router.get('/templates/:id', templateController.get);
  router.post('/templates', templateController.create);
  router.put('/templates/:id', templateController.update);
  router.post('/templates/:id/submit', templateController.submit);
  router.post('/templates/sync', templateController.syncFromMeta);
  router.post('/templates/:id/test', templateController.test);
  router.delete('/templates/:id', templateController.delete);

  router.post('/catalog-templates', catalogMessageController.createCatalogTemplate);
  router.post('/catalog-templates/send', sendMessageRateLimiter, catalogMessageController.sendCatalogTemplate);
  router.post('/catalog-messages/send', sendMessageRateLimiter, catalogMessageController.sendCatalogMessage);
  router.post('/catalog-messages/send-product', sendMessageRateLimiter, catalogMessageController.sendSingleProduct);
  router.post('/catalog-messages/send-products', sendMessageRateLimiter, catalogMessageController.sendMultiProduct);
  router.post(
    '/catalog-messages/send-by-categories',
    sendMessageRateLimiter,
    catalogMessageController.sendProductsByCategories,
  );
  router.get('/catalog-products', catalogMessageController.listCatalogProducts);
  router.get('/catalog-categories', catalogMessageController.listCatalogCategories);
  router.get('/catalog-sections/preview', catalogMessageController.previewSections);
  router.get('/commerce-settings', catalogMessageController.getCommerceSettings);
  router.put('/commerce-settings', catalogMessageController.updateCommerceSettings);

  router.get('/timelines/lead/:leadId', timelineController.getLeadTimeline);
  router.get('/timelines/booking/:bookingId', timelineController.getBookingTimeline);
  router.get('/timelines/departure/:departureId', timelineController.getDepartureTimeline);
  router.get('/timelines/trip/:tripId', timelineController.getTripTimeline);
  router.post('/timelines/note', timelineController.addNote);
  router.get('/timelines/search', timelineController.search);

  router.get('/health', async (_req, res) => {
    try {
      const config = getConfig();
      res.json({
        status: 'ok',
        provider: 'meta',
        apiVersion: config.whatsapp.meta?.apiVersion,
        phoneNumberId: config.whatsapp.meta?.phoneNumberId
          ? `***${config.whatsapp.meta.phoneNumberId.slice(-4)}`
          : 'not set',
        webhookVerifyToken: config.whatsapp.verifyToken ? 'set' : 'not set',
      });
    } catch (error) {
      res.status(500).json({ status: 'error', message: (error as Error).message });
    }
  });

  return router;
}

export default createWhatsAppRoutes;
