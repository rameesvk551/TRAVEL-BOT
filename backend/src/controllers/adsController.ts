const metaAdsService = require('../services/metaAdsService');

function getWebhookSecret(headers = {}) {
  const auth = String(headers.authorization || '').replace(/^Bearer\s+/i, '');
  return headers['x-marketing-os-secret'] || headers['x-travelbot-secret'] || auth;
}

function assertValidProviderWebhook(req) {
  const configuredSecret = process.env.MARKETING_OS_WEBHOOK_SECRET || '';
  if (!configuredSecret) return;
  if (getWebhookSecret(req.headers) !== configuredSecret) {
    throw Object.assign(new Error('Invalid Meta lead webhook secret'), {
      statusCode: 401,
      code: 'INVALID_META_LEAD_WEBHOOK_SECRET',
    });
  }
}

async function verifyLeadgenWebhook(req, res, next) {
  try {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const expectedToken = process.env.META_WEBHOOK_VERIFY_TOKEN
      || process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN
      || process.env.WHATSAPP_VERIFY_TOKEN
      || process.env.MARKETING_OS_WEBHOOK_SECRET
      || '';

    if (mode === 'subscribe' && token && challenge && token === expectedToken) {
      res.status(200).send(String(challenge));
      return;
    }

    res.status(403).json({
      success: false,
      code: 'INVALID_META_WEBHOOK_VERIFY_TOKEN',
      error: 'Invalid Meta lead webhook verify token',
    });
  } catch (err) {
    next(err);
  }
}

async function listAccounts(req, res, next) {
  try {
    const data = await metaAdsService.listAdAccounts(req.agency.id);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function createConnectSession(req, res, next) {
  try {
    const data = await metaAdsService.createConnectSession(req.agency.id, req.body || {});
    res.json({ success: true, data, message: 'Meta Ads connect session created' });
  } catch (err) {
    next(err);
  }
}

async function listCampaigns(req, res, next) {
  try {
    const data = await metaAdsService.listCampaigns(req.agency.id, req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getCampaign(req, res, next) {
  try {
    const data = await metaAdsService.getCampaign(req.agency.id, req.params.campaignId);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getCampaignInsights(req, res, next) {
  try {
    const data = await metaAdsService.getCampaignInsights(req.agency.id, req.params.campaignId, req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listForms(req, res, next) {
  try {
    const data = await metaAdsService.listForms(req.agency.id, req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function backfillForm(req, res, next) {
  try {
    const data = await metaAdsService.backfillForm(req.agency.id, req.params.formId, req.body || {});
    res.json({ success: true, data, message: `${data.imported} Meta leads imported` });
  } catch (err) {
    next(err);
  }
}

async function handleLeadgenWebhook(req, res, next) {
  try {
    assertValidProviderWebhook(req);
    const data = await metaAdsService.handleLeadgenWebhook(req.body || {});
    res.json({
      success: true,
      data: {
        leadId: data.lead?.id,
        duplicate: data.duplicate,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  verifyLeadgenWebhook,
  createConnectSession,
  listAccounts,
  listCampaigns,
  getCampaign,
  getCampaignInsights,
  listForms,
  backfillForm,
  handleLeadgenWebhook,
};
