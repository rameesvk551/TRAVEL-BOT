const axios = require('axios');
const { Op } = require('sequelize');
const { Agency, Campaign, CampaignRecipient, Customer, Message } = require('../models');
const marketingOsPartnerService = require('./marketingOsPartnerService');
const { normalizePhone } = require('../utils/phoneUtils');

const interaktClient = axios.create({
  baseURL: process.env.INTERAKT_BASE_URL || 'https://api.interakt.ai/v1/public',
  headers: {
    Authorization: `Basic ${process.env.INTERAKT_API_KEY}`,
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

function canUseCloudApi(phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID) {
  return !!(process.env.WHATSAPP_CLOUD_API_TOKEN && phoneNumberId);
}

function isTypingIndicatorEnabled() {
  return String(process.env.WHATSAPP_TYPING_ENABLED || 'true').toLowerCase() !== 'false';
}

function getSimulatedTypingDelayMs() {
  const value = Number(process.env.WHATSAPP_SIMULATED_TYPING_DELAY_MS || 1200);
  if (!Number.isFinite(value) || value < 0) return 1200;
  return Math.min(value, 5000);
}

function isProcessingPlaceholderEnabled() {
  return String(process.env.WHATSAPP_PROCESSING_PLACEHOLDER_ENABLED || 'true').toLowerCase() !== 'false';
}

function getProcessingPlaceholderText() {
  return String(process.env.WHATSAPP_PROCESSING_PLACEHOLDER_TEXT || 'Checking packages for you, one moment...').trim();
}

let marketingOsTypingUnavailable = false;

function getMetaClient(phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID) {
  if (!canUseCloudApi(phoneNumberId)) return null;

  return axios.create({
    baseURL: `https://graph.facebook.com/v21.0/${phoneNumberId}`,
    headers: {
      Authorization: `Bearer ${process.env.WHATSAPP_CLOUD_API_TOKEN}`,
      'Content-Type': 'application/json',
    },
    timeout: 15000,
  });
}

function toMetaRecipient(phone) {
  return String(phone || '').replace(/^\+/, '');
}

async function createOutboundMessage(context, payload) {
  const { customerId, agencyId, agentId } = context;
  return Message.create({
    customerId,
    agencyId,
    agentId: agentId || null,
    direction: 'OUT',
    content: payload.content,
    type: payload.type || 'TEXT',
    templateName: payload.templateName || null,
    status: 'SENT',
    timestamp: new Date(),
  });
}

async function markMessageSent(message, response) {
  const waMessageId = response?.data?.messages?.[0]?.id
    || response?.data?.id
    || response?.data?.data?.messageId
    || response?.data?.data?.providerMessageId
    || response?.data?.messageId
    || response?.data?.providerMessageId
    || null;
  if (waMessageId) {
    await message.update({ waMessageId });
  }
  return message;
}

async function markMessageFailed(message, scope, err) {
  console.error(`[WhatsAppService] ${scope} error:`, err.response?.data || err.message);
  await message.update({ status: 'FAILED' });
  return message;
}

async function isCustomerIn24hWindow(context = {}) {
  if (!context?.customerId || !context?.agencyId) return false;

  const customerIds = new Set([context.customerId]);
  const customer = await Customer.findOne({
    where: { id: context.customerId, agencyId: context.agencyId },
    attributes: ['id', 'phone'],
  });

  if (customer?.phone) {
    const normalizedPhone = normalizePhone(customer.phone);
    const phoneCandidates = Array.from(new Set([
      customer.phone,
      normalizedPhone,
      normalizedPhone?.replace(/^\+91/, ''),
    ].filter(Boolean)));

    const matchingCustomers = await Customer.findAll({
      where: {
        agencyId: context.agencyId,
        phone: { [Op.in]: phoneCandidates },
      },
      attributes: ['id'],
    });

    matchingCustomers.forEach((matchingCustomer) => customerIds.add(matchingCustomer.id));
  }

  const lastIncoming = await Message.findOne({
    where: {
      customerId: { [Op.in]: Array.from(customerIds) },
      agencyId: context.agencyId,
      direction: 'IN',
    },
    order: [['timestamp', 'DESC']],
  });

  if (!lastIncoming?.timestamp) return false;
  return Date.now() - new Date(lastIncoming.timestamp).getTime() < 24 * 60 * 60 * 1000;
}

async function resolveAgencyChannel(context = {}) {
  if (!context?.agencyId) {
    return {
      provider: 'SELF_HOSTED',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || null,
      marketingOsTenantId: null,
      isInstagram: false,
    };
  }

  let isInstagram = false;
  if (context.customerId) {
    const customer = await Customer.findOne({
      where: { id: context.customerId, agencyId: context.agencyId },
      attributes: ['id', 'phone', 'source'],
    });
    isInstagram = String(customer?.phone || '').startsWith('ig_')
      || String(customer?.source || '').toLowerCase() === 'instagram';
  }

  const agency = await Agency.findByPk(context.agencyId, {
    attributes: ['id', 'whatsappProvider', 'whatsappPhoneNumberId', 'marketingOsTenantId'],
  });

  return {
    provider: agency?.whatsappProvider || 'SELF_HOSTED',
    phoneNumberId: agency?.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || null,
    marketingOsTenantId: agency?.marketingOsTenantId || null,
    isInstagram,
  };
}

async function sendViaMeta(phone, payload, phoneNumberId) {
  const client = getMetaClient(phoneNumberId);
  if (!client) {
    throw new Error('Meta Cloud API is not configured');
  }

  return client.post('/messages', {
    messaging_product: 'whatsapp',
    to: toMetaRecipient(phone),
    ...payload,
  });
}

async function sendTypingIndicator(phone, incomingWaMessageId, context = {}) {
  if (!isTypingIndicatorEnabled()) return null;
  if (marketingOsTypingUnavailable) return null;

  const messageId = String(incomingWaMessageId || '').trim();
  if (!messageId) return null;

  try {
    const channel = await resolveAgencyChannel(context);

    if (canUseMarketingOs(channel) && channel.marketingOsTenantId) {
      const tenantToken = await marketingOsPartnerService.getTenantToken(channel.marketingOsTenantId);
      return await marketingOsPartnerService.sendTenantWhatsAppReadTyping(tenantToken, {
        tenantId: channel.marketingOsTenantId,
        to: toMetaRecipient(phone),
        messageId,
      });
    }

    if (!canUseCloudApi(channel.phoneNumberId)) return null;

    return await sendViaMeta(phone, {
      status: 'read',
      message_id: messageId,
      typing_indicator: {
        type: 'text',
      },
    }, channel.phoneNumberId);
  } catch (err) {
    if (
      err?.response?.data?.code === 'NOT_FOUND'
      || /route not found/i.test(String(err?.response?.data?.message || err?.message || ''))
    ) {
      marketingOsTypingUnavailable = true;
      console.warn('[WhatsAppService] Typing indicator route unavailable, disabling typing indicator sends');
      return null;
    }
    console.warn('[WhatsAppService] sendTypingIndicator error:', err.response?.data || err.message);
    return null;
  }
}

async function waitForReplyPacing(context = {}) {
  if (!isTypingIndicatorEnabled()) return;

  try {
    const channel = await resolveAgencyChannel(context);

    // Marketing OS currently does not expose native typing indicator controls,
    // so we pause briefly to emulate human response pacing.
    if (canUseMarketingOs(channel)) {
      const delayMs = getSimulatedTypingDelayMs();
      if (delayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  } catch (err) {
    console.warn('[WhatsAppService] waitForReplyPacing error:', err.response?.data || err.message);
  }
}

async function sendProcessingPlaceholder(phone, context = {}) {
  if (!isProcessingPlaceholderEnabled()) return null;

  try {
    const channel = await resolveAgencyChannel(context);
    if (!canUseMarketingOs(channel)) return null;

    const text = getProcessingPlaceholderText();
    if (!text) return null;

    return sendTextMessage(phone, text, context);
  } catch (err) {
    console.warn('[WhatsAppService] sendProcessingPlaceholder error:', err.response?.data || err.message);
    return null;
  }
}

function canUseMarketingOs(channel = {}) {
  return (channel?.provider === 'MARKETING_OS' || channel?.isInstagram) && !!channel?.marketingOsTenantId;
}

function ensureMarketingOsSuccess(data, scope) {
  if (data?.success === false) {
    const error = Object.assign(new Error(data?.error || `${scope} failed`), {
      response: { data },
    });
    throw error;
  }

  return data;
}

async function sendViaMarketingOs(phone, payload, tenantId) {
  const idempotencyKey = `travelbot-${tenantId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const tenantToken = await marketingOsPartnerService.getTenantToken(tenantId);
  let data;

  const isInstagram = String(phone).startsWith('ig_');
  const instagramAddress = isInstagram ? String(phone).substring(3) : '';
  const separatorIndex = instagramAddress.indexOf(':');
  const instagramAccountId = separatorIndex > -1 ? instagramAddress.slice(0, separatorIndex) : null;
  const actualRecipient = isInstagram
    ? (separatorIndex > -1 ? instagramAddress.slice(separatorIndex + 1) : instagramAddress)
    : toMetaRecipient(phone);

  if (isInstagram) {
    // Currently, Instagram via Marketing OS only supports basic text/media proxying out-of-the-box
    // For rich interactives, we send fallback text.
    let textToSend = payload.text;
    if (payload.type === 'interactive' || payload.type === 'template') {
       textToSend = payload.content || payload.text || JSON.stringify(payload);
    }
    
    data = await marketingOsPartnerService.sendTenantInstagramMessage(tenantToken, {
      tenantId,
      accountId: instagramAccountId || payload.accountId,
      recipientId: actualRecipient,
      text: textToSend,
    });
  } else if (payload.type === 'template') {
    data = await marketingOsPartnerService.sendTenantWhatsAppTemplate(tenantToken, {
      tenantId,
      to: actualRecipient,
      templateName: payload.templateName,
      language: payload.languageCode || 'en',
      components: payload.components || null,
      variables: payload.variables || {},
      idempotencyKey,
    });
  } else if (payload.type === 'interactive') {
    data = await marketingOsPartnerService.sendTenantWhatsAppInteractive(tenantToken, {
      tenantId,
      to: actualRecipient,
      recipientPhone: actualRecipient,
      interactiveContent: payload.interactiveContent,
      idempotencyKey,
    });
  } else if (payload.type === 'media') {
    data = await marketingOsPartnerService.sendTenantWhatsAppMedia(tenantToken, {
      tenantId,
      to: actualRecipient,
      recipientPhone: actualRecipient,
      mediaUrl: payload.mediaUrl,
      caption: payload.caption,
      mediaType: payload.mediaType || 'image',
      mimeType: payload.mimeType,
      idempotencyKey,
    });
  } else {
    data = await marketingOsPartnerService.sendTenantWhatsAppMessage(tenantToken, {
      tenantId,
      to: actualRecipient,
      body: payload.text,
      idempotencyKey,
    });
  }

  ensureMarketingOsSuccess(data, `Marketing OS ${payload.type || 'message'} send`);
  return { data };
}

function renderButtonsFallback(body, buttons, options = {}) {
  const header = options.headerText ? `*${options.headerText}*\n` : '';
  const footer = options.footerText ? `\n${options.footerText}` : '';
  const lines = buttons.map((button, index) => `${index + 1}. ${button.title}`).join('\n');
  return `${header}${body}\n\n${lines}${footer}`.trim();
}

function renderListFallback(body, sections, options = {}) {
  const header = options.headerText ? `*${options.headerText}*\n` : '';
  const footer = options.footerText ? `\n${options.footerText}` : '';
  const sectionText = sections.map((section) => {
    const lines = section.rows.map((row, index) => `${index + 1}. ${row.title}${row.description ? ` - ${row.description}` : ''}`).join('\n');
    return section.title ? `*${section.title}*\n${lines}` : lines;
  }).join('\n\n');

  return `${header}${body}\n\n${sectionText}${footer}`.trim();
}

function normalizeImageUrlForWhatsApp(imageUrl) {
  const url = String(imageUrl || '').trim();
  if (!url) return url;

  const isCloudinaryUpload = url.includes('res.cloudinary.com')
    && url.includes('/image/upload/');

  if (!isCloudinaryUpload) {
    return url;
  }

  if (/\.svg(?:\?|$)/i.test(url) || /\.webp(?:\?|$)/i.test(url)) {
    return url
      .replace('/image/upload/', '/image/upload/f_png/')
      .replace(/\.(svg|webp)(\?|$)/i, '.png$2');
  }

  return url;
}

async function sendTextMessage(phone, content, context) {
  const message = await createOutboundMessage(context, {
    content,
    type: 'TEXT',
  });

  try {
    const channel = await resolveAgencyChannel(context);

    if (canUseMarketingOs(channel)) {
      const response = await sendViaMarketingOs(phone, {
        type: 'text',
        text: content,
      }, channel.marketingOsTenantId);
      return markMessageSent(message, response);
    }

    if (canUseCloudApi(channel.phoneNumberId)) {
      const response = await sendViaMeta(phone, {
        type: 'text',
        text: {
          preview_url: false,
          body: content,
        },
      }, channel.phoneNumberId);
      return markMessageSent(message, response);
    }

    const response = await interaktClient.post('/message/', {
      countryCode: '+91',
      phoneNumber: phone.replace('+91', ''),
      callbackData: message.id,
      type: 'Text',
      data: { message: content },
    });

    return markMessageSent(message, response);
  } catch (err) {
    return markMessageFailed(message, 'sendTextMessage', err);
  }
}

async function sendButtonsMessage(phone, body, buttons, context, options = {}) {
  const fallbackContent = renderButtonsFallback(body, buttons, options);
  const channel = await resolveAgencyChannel(context);

  if (canUseMarketingOs(channel)) {
    const message = await createOutboundMessage(context, {
      content: fallbackContent,
      type: 'TEXT',
    });

    try {
      const response = await sendViaMarketingOs(phone, {
        type: 'interactive',
        interactiveContent: {
          type: 'BUTTON',
          header: options.headerText,
          body,
          footer: options.footerText,
          buttons: buttons.slice(0, 3).map((button) => ({
            id: button.id,
            title: button.title,
          })),
        },
      }, channel.marketingOsTenantId);
      return markMessageSent(message, response);
    } catch (err) {
      return markMessageFailed(message, 'sendButtonsMessage', err);
    }
  }

  if (!canUseCloudApi(channel.phoneNumberId)) {
    return sendTextMessage(phone, fallbackContent, context);
  }

  const message = await createOutboundMessage(context, {
    content: fallbackContent,
    type: 'TEXT',
  });

  try {
    const response = await sendViaMeta(phone, {
      type: 'interactive',
      interactive: {
        type: 'button',
        header: options.headerText ? { type: 'text', text: options.headerText } : undefined,
        body: { text: body },
        footer: options.footerText ? { text: options.footerText } : undefined,
        action: {
          buttons: buttons.slice(0, 3).map((button) => ({
            type: 'reply',
            reply: {
              id: button.id,
              title: button.title,
            },
          })),
        },
      },
    }, channel.phoneNumberId);

    return markMessageSent(message, response);
  } catch (err) {
    return markMessageFailed(message, 'sendButtonsMessage', err);
  }
}

async function sendMediaButtonsMessage(phone, body, imageUrl, buttons, context, options = {}) {
  const normalizedImageUrl = normalizeImageUrlForWhatsApp(imageUrl);

  if (!normalizedImageUrl) {
    return sendButtonsMessage(phone, body, buttons, context, options);
  }

  const fallbackContent = `${renderButtonsFallback(body, buttons, options)}\n${normalizedImageUrl}`.trim();
  const channel = await resolveAgencyChannel(context);

  if (canUseMarketingOs(channel)) {
    const message = await createOutboundMessage(context, {
      content: fallbackContent,
      type: 'IMAGE',
    });

    try {
      const response = await sendViaMarketingOs(phone, {
        type: 'interactive',
        interactiveContent: {
          type: 'BUTTON',
          header: {
            type: 'image',
            imageUrl: normalizedImageUrl,
          },
          body,
          footer: options.footerText,
          buttons: buttons.slice(0, 3).map((button) => ({
            id: button.id,
            title: button.title,
          })),
        },
      }, channel.marketingOsTenantId);
      return markMessageSent(message, response);
    } catch (err) {
      return markMessageFailed(message, 'sendMediaButtonsMessage', err);
    }
  }

  if (!canUseCloudApi(channel.phoneNumberId)) {
    return sendTextMessage(phone, fallbackContent, context);
  }

  const message = await createOutboundMessage(context, {
    content: fallbackContent,
    type: 'IMAGE',
  });

  try {
    const response = await sendViaMeta(phone, {
      type: 'interactive',
      interactive: {
        type: 'button',
        header: {
          type: 'image',
          image: {
            link: normalizedImageUrl,
          },
        },
        body: { text: body },
        footer: options.footerText ? { text: options.footerText } : undefined,
        action: {
          buttons: buttons.slice(0, 3).map((button) => ({
            type: 'reply',
            reply: {
              id: button.id,
              title: button.title,
            },
          })),
        },
      },
    }, channel.phoneNumberId);

    return markMessageSent(message, response);
  } catch (err) {
    return markMessageFailed(message, 'sendMediaButtonsMessage', err);
  }
}

async function sendListMessage(phone, body, buttonText, sections, context, options = {}) {
  const fallbackContent = renderListFallback(body, sections, options);
  const channel = await resolveAgencyChannel(context);

  if (canUseMarketingOs(channel)) {
    const message = await createOutboundMessage(context, {
      content: fallbackContent,
      type: 'TEXT',
    });

    try {
      const response = await sendViaMarketingOs(phone, {
        type: 'interactive',
        interactiveContent: {
          type: 'LIST',
          header: options.headerText,
          body,
          footer: options.footerText,
          sections,
          action: {
            button: buttonText,
          },
        },
      }, channel.marketingOsTenantId);
      return markMessageSent(message, response);
    } catch (err) {
      return markMessageFailed(message, 'sendListMessage', err);
    }
  }

  if (!canUseCloudApi(channel.phoneNumberId)) {
    return sendTextMessage(phone, fallbackContent, context);
  }

  const message = await createOutboundMessage(context, {
    content: fallbackContent,
    type: 'TEXT',
  });

  try {
    const response = await sendViaMeta(phone, {
      type: 'interactive',
      interactive: {
        type: 'list',
        header: options.headerText ? { type: 'text', text: options.headerText } : undefined,
        body: { text: body },
        footer: options.footerText ? { text: options.footerText } : undefined,
        action: {
          button: buttonText,
          sections,
        },
      },
    }, channel.phoneNumberId);

    return markMessageSent(message, response);
  } catch (err) {
    return markMessageFailed(message, 'sendListMessage', err);
  }
}

async function sendImageMessage(phone, imageUrl, caption, context) {
  const normalizedImageUrl = normalizeImageUrlForWhatsApp(imageUrl);
  const fallbackContent = caption ? `${caption}\n${normalizedImageUrl}` : normalizedImageUrl;
  const channel = await resolveAgencyChannel(context);

  if (canUseMarketingOs(channel)) {
    const message = await createOutboundMessage(context, {
      content: fallbackContent,
      type: 'IMAGE',
    });

    try {
      const response = await sendViaMarketingOs(phone, {
        type: 'media',
        mediaUrl: normalizedImageUrl,
        caption,
        mediaType: 'image',
        mimeType: 'image/jpeg',
      }, channel.marketingOsTenantId);
      return markMessageSent(message, response);
    } catch (err) {
      return markMessageFailed(message, 'sendImageMessage', err);
    }
  }

  if (!canUseCloudApi(channel.phoneNumberId)) {
    return sendTextMessage(phone, fallbackContent, context);
  }

  const message = await createOutboundMessage(context, {
    content: fallbackContent,
    type: 'IMAGE',
  });

  try {
    const response = await sendViaMeta(phone, {
      type: 'image',
      image: {
        link: normalizedImageUrl,
        caption: caption || undefined,
      },
    }, channel.phoneNumberId);

    return markMessageSent(message, response);
  } catch (err) {
    return markMessageFailed(message, 'sendImageMessage', err);
  }
}

async function sendDocumentMessage(phone, documentUrl, filename, caption, context) {
  const url = String(documentUrl || '').trim();
  const safeFilename = String(filename || 'brochure.pdf').trim() || 'brochure.pdf';
  const fallbackContent = [caption, safeFilename, url].filter(Boolean).join('\n');
  const channel = await resolveAgencyChannel(context);

  if (canUseMarketingOs(channel)) {
    const message = await createOutboundMessage(context, {
      content: fallbackContent,
      type: 'DOCUMENT',
    });

    try {
      const response = await sendViaMarketingOs(phone, {
        type: 'media',
        mediaUrl: url,
        caption,
        mediaType: 'document',
        mimeType: 'application/pdf',
      }, channel.marketingOsTenantId);
      return markMessageSent(message, response);
    } catch (err) {
      return markMessageFailed(message, 'sendDocumentMessage', err);
    }
  }

  if (!canUseCloudApi(channel.phoneNumberId)) {
    return sendTextMessage(phone, fallbackContent, context);
  }

  const message = await createOutboundMessage(context, {
    content: fallbackContent,
    type: 'DOCUMENT',
  });

  try {
    const response = await sendViaMeta(phone, {
      type: 'document',
      document: {
        link: url,
        filename: safeFilename,
        caption: caption || undefined,
      },
    }, channel.phoneNumberId);

    return markMessageSent(message, response);
  } catch (err) {
    return markMessageFailed(message, 'sendDocumentMessage', err);
  }
}

async function sendFlowMessage(phone, body, flowConfig, context, options = {}) {
  const {
    flowId,
    flowName,
    flowToken,
    flowCta,
    flowMode = 'published',
    firstScreenId,
    action = 'navigate',
    data,
  } = flowConfig || {};

  const fallbackContent = `${options.headerText ? `*${options.headerText}*\n` : ''}${body}\n\n${flowCta || 'Continue'}${options.footerText ? `\n${options.footerText}` : ''}`.trim();
  const channel = await resolveAgencyChannel(context);

  if (canUseMarketingOs(channel) && (flowId || flowName)) {
    const message = await createOutboundMessage(context, {
      content: fallbackContent,
      type: 'TEXT',
    });

    try {
      const parameters = {
        flow_message_version: '3',
        flow_cta: flowCta || 'Continue',
        mode: flowMode,
        flow_token: flowToken || `trip-flow-${Date.now()}`,
        flow_action: action,
      };

      if (flowId) parameters.flow_id = flowId;
      if (flowName) parameters.flow_name = flowName;
      if (action === 'navigate' && (firstScreenId || (data && Object.keys(data).length))) {
        parameters.flow_action_payload = {};
        if (firstScreenId) parameters.flow_action_payload.screen = firstScreenId;
        if (data && Object.keys(data).length) parameters.flow_action_payload.data = data;
      }

      const response = await sendViaMarketingOs(phone, {
        type: 'interactive',
        interactiveContent: {
          type: 'FLOW',
          header: options.headerText,
          body,
          footer: options.footerText,
          action: {
            name: 'flow',
            parameters,
          },
        },
      }, channel.marketingOsTenantId);

      return markMessageSent(message, response);
    } catch (err) {
      await markMessageFailed(message, 'sendFlowMessage', err);
      return sendTextMessage(phone, fallbackContent, context);
    }
  }

  if (!canUseCloudApi(channel.phoneNumberId) || (!flowId && !flowName)) {
    return sendTextMessage(phone, fallbackContent, context);
  }

  const message = await createOutboundMessage(context, {
    content: fallbackContent,
    type: 'TEXT',
  });

  const parameters = {
    flow_message_version: '3',
    flow_cta: flowCta || 'Continue',
    mode: flowMode,
    flow_token: flowToken || `trip-flow-${Date.now()}`,
    flow_action: action,
  };

  if (flowId) parameters.flow_id = flowId;
  if (flowName) parameters.flow_name = flowName;
  if (action === 'navigate' && (firstScreenId || (data && Object.keys(data).length))) {
    parameters.flow_action_payload = {};
    if (firstScreenId) parameters.flow_action_payload.screen = firstScreenId;
    if (data && Object.keys(data).length) parameters.flow_action_payload.data = data;
  }

  try {
    const response = await sendViaMeta(phone, {
      type: 'interactive',
      interactive: {
        type: 'flow',
        header: options.headerText ? { type: 'text', text: options.headerText } : undefined,
        body: { text: body },
        footer: options.footerText ? { text: options.footerText } : undefined,
        action: {
          name: 'flow',
          parameters,
        },
      },
    }, channel.phoneNumberId);

    return markMessageSent(message, response);
  } catch (err) {
    await markMessageFailed(message, 'sendFlowMessage', err);
    return sendTextMessage(phone, fallbackContent, context);
  }
}

async function sendTemplateMessage(phone, templateName, variables, context, options = {}) {
  const content = `[Template: ${templateName}] ${variables.join(', ')}`;
  const channel = await resolveAgencyChannel(context);

  if (canUseMarketingOs(channel)) {
    const message = await createOutboundMessage(context, {
      content,
      type: 'TEMPLATE',
      templateName,
    });

    try {
      const componentPayload = buildTemplateSendComponents(options.template, variables);
      const response = await sendViaMarketingOs(phone, {
        type: 'template',
        templateName,
        languageCode: 'en',
        variables: variables.reduce((acc, value, index) => {
          acc[String(index + 1)] = value;
          return acc;
        }, {}),
        components: componentPayload,
      }, channel.marketingOsTenantId);

      return markMessageSent(message, response);
    } catch (err) {
      return markMessageFailed(message, 'sendTemplateMessage', err);
    }
  }

  if (!process.env.INTERAKT_API_KEY) {
    return sendTextMessage(phone, content, context);
  }

  const message = await createOutboundMessage(context, {
    content,
    type: 'TEMPLATE',
    templateName,
  });

  try {
    const response = await interaktClient.post('/message/', {
      countryCode: '+91',
      phoneNumber: phone.replace('+91', ''),
      callbackData: message.id,
      type: 'Template',
      template: {
        name: templateName,
        languageCode: 'en',
        bodyValues: variables,
      },
    });

    return markMessageSent(message, response);
  } catch (err) {
    return markMessageFailed(message, 'sendTemplateMessage', err);
  }
}

async function sendTemplateOrTextIn24hWindow(phone, { templateName, variables = [], text, context }) {
  const in24hWindow = await isCustomerIn24hWindow(context);

  if (in24hWindow && text) {
    return sendTextMessage(phone, text, context);
  }

  return sendTemplateMessage(phone, templateName, variables, context);
}

async function sendFallbackMessage(phone, agencyPhone, context) {
  const content = `Hi! We received your message. Our team will get back to you shortly. For urgent help, call ${agencyPhone}.`;
  return sendTextMessage(phone, content, context);
}

async function sendCatalogMessage(phone, body, catalogId, productIds, context, options = {}) {
  const fallbackContent = `${options.headerText ? `*${options.headerText}*\n` : ''}${body}\n\n*Check out our Catalog inside WhatsApp!*${options.footerText ? `\n${options.footerText}` : ''}`.trim();
  const channel = await resolveAgencyChannel(context);

  if (!catalogId || !productIds || productIds.length === 0) {
    return sendTextMessage(phone, fallbackContent, context);
  }

  const message = await createOutboundMessage(context, {
    content: fallbackContent,
    type: 'TEXT', // Internal fallback representation since we don't have a CATALOG type
  });

  const sections = [
    {
      title: 'Our Packages',
      product_items: productIds.slice(0, 30).map((id) => ({ product_retailer_id: String(id) })),
    },
  ];

  if (canUseMarketingOs(channel)) {
    try {
      const response = await sendViaMarketingOs(phone, {
        type: 'interactive',
        interactiveContent: {
          type: 'PRODUCT_LIST',
          header: options.headerText,
          body,
          footer: options.footerText,
          action: {
            catalog_id: catalogId,
            sections,
          },
        },
      }, channel.marketingOsTenantId);

      return markMessageSent(message, response);
    } catch (err) {
      return markMessageFailed(message, 'sendCatalogMessage', err);
    }
  }

  if (!canUseCloudApi(channel.phoneNumberId)) {
    return sendTextMessage(phone, fallbackContent, context);
  }

  try {
    const response = await sendViaMeta(phone, {
      type: 'interactive',
      interactive: {
        type: 'product_list',
        header: options.headerText ? { type: 'text', text: options.headerText } : undefined,
        body: { text: body },
        footer: options.footerText ? { text: options.footerText } : undefined,
        action: {
          catalog_id: catalogId,
          sections,
        },
      },
    }, channel.phoneNumberId);

    return markMessageSent(message, response);
  } catch (err) {
    return markMessageFailed(message, 'sendCatalogMessage', err);
  }
}

async function updateMessageStatus(waMessageId, newStatus) {
  if (!waMessageId) return;

  const statusMap = {
    delivered: 'DELIVERED',
    read: 'READ',
    failed: 'FAILED',
    sent: 'SENT',
  };

  const status = statusMap[String(newStatus || '').toLowerCase()] || newStatus;

  await Message.update(
    { status },
    { where: { waMessageId } }
  );

  const recipientUpdates = {};
  if (status === 'DELIVERED') {
    recipientUpdates.status = 'DELIVERED';
    recipientUpdates.deliveredAt = new Date();
  } else if (status === 'READ') {
    recipientUpdates.status = 'READ';
    recipientUpdates.readAt = new Date();
  } else if (status === 'FAILED') {
    recipientUpdates.status = 'FAILED';
  }

  if (Object.keys(recipientUpdates).length) {
    await CampaignRecipient.update(
      recipientUpdates,
      { where: { waMessageId } }
    );
    await refreshCampaignStatsForMessage(waMessageId);
  }
}

async function refreshCampaignStats(campaignId) {
  if (!campaignId) return;

  const [sent, delivered, read, replied, failed] = await Promise.all([
    CampaignRecipient.count({ where: { campaignId, status: 'SENT' } }),
    CampaignRecipient.count({ where: { campaignId, status: 'DELIVERED' } }),
    CampaignRecipient.count({ where: { campaignId, status: 'READ' } }),
    CampaignRecipient.count({ where: { campaignId, status: 'REPLIED' } }),
    CampaignRecipient.count({ where: { campaignId, status: 'FAILED' } }),
  ]);

  await Campaign.update(
    { sent, delivered, read, replied, failed },
    { where: { id: campaignId } }
  );
}

async function refreshCampaignStatsForMessage(waMessageId) {
  const recipient = await CampaignRecipient.findOne({
    where: { waMessageId },
    attributes: ['campaignId'],
  });

  if (recipient?.campaignId) {
    await refreshCampaignStats(recipient.campaignId);
  }
}

async function markLatestCampaignReply(customerId, agencyId) {
  if (!customerId || !agencyId) return;

  const recipient = await CampaignRecipient.findOne({
    include: [{
      model: Campaign,
      as: 'campaign',
      where: { agencyId },
      attributes: ['id'],
      required: true,
    }],
    where: {
      customerId,
      status: { [Op.in]: ['SENT', 'DELIVERED', 'READ'] },
    },
    order: [['sentAt', 'DESC']],
  });

  if (!recipient) return;

  await recipient.update({
    status: 'REPLIED',
    repliedAt: new Date(),
  });
  await refreshCampaignStats(recipient.campaignId);
}

async function sendSystemNotificationWhatsApp(phone, content, context = {}) {
  try {
    const channel = await resolveAgencyChannel(context);

    if (canUseMarketingOs(channel)) {
      return await sendViaMarketingOs(phone, {
        type: 'text',
        text: content,
      }, channel.marketingOsTenantId);
    }

    if (canUseCloudApi(channel.phoneNumberId)) {
      return await sendViaMeta(phone, {
        type: 'text',
        text: {
          preview_url: false,
          body: content,
        },
      }, channel.phoneNumberId);
    }

    return await interaktClient.post('/message/', {
      countryCode: '+91',
      phoneNumber: String(phone).replace('+91', ''),
      callbackData: 'system-notification',
      type: 'Text',
      data: { message: content },
    });
  } catch (err) {
    console.warn('[WhatsAppService] sendSystemNotificationWhatsApp error:', err.response?.data || err.message);
    return null;
  }
}

async function syncTemplatesWithMeta(agencyId) {
  const channel = await resolveAgencyChannel({ agencyId });
  
  if (canUseMarketingOs(channel)) {
    const tenantToken = await marketingOsPartnerService.getTenantToken(channel.marketingOsTenantId);
    return await marketingOsPartnerService.syncTenantWhatsAppTemplates(tenantToken);
  }
  
  if (canUseCloudApi(channel.phoneNumberId)) {
    // Direct Meta sync would go here
    throw new Error('Direct Meta template sync not yet implemented in SELF_HOSTED mode');
  }
  
  throw new Error('No WhatsApp provider configured for template sync');
}

function buildTemplateComponents(template) {
  const components = [];
  const headerType = String(template.headerType || 'NONE').toUpperCase();
  const variableSamples = Array.isArray(template.sampleVariables) ? template.sampleVariables : [];
  const templateType = String(template.templateType || 'STANDARD').toUpperCase();
  const buildMediaExample = (mediaUrl) => {
    const trimmed = String(mediaUrl || '').trim();
    return trimmed ? { header_handle: [trimmed] } : undefined;
  };

  if (templateType !== 'CAROUSEL' && headerType !== 'NONE') {
    const header = { type: 'HEADER', format: headerType };
    if (headerType === 'TEXT') {
      header.text = template.headerContent || '';
      if (countTemplateVariables(header.text) > 0 && variableSamples.length > 0) {
        header.example = { header_text: [variableSamples[0]] };
      }
    } else {
      const mediaExample = buildMediaExample(template.headerContent);
      if (mediaExample) {
        header.example = mediaExample;
      }
    }
    components.push(header);
  }

  const body = { type: 'BODY', text: template.body || '' };
  const bodyVariableCount = countTemplateVariables(body.text);
  if (bodyVariableCount > 0 && variableSamples.length >= bodyVariableCount) {
    body.example = { body_text: [variableSamples.slice(0, bodyVariableCount)] };
  }
  components.push(body);

  if (templateType !== 'CAROUSEL' && template.footer) {
    components.push({ type: 'FOOTER', text: template.footer });
  }

  if (templateType !== 'CAROUSEL' && Array.isArray(template.buttons) && template.buttons.length > 0) {
    components.push({
      type: 'BUTTONS',
      buttons: template.buttons.map((button) => ({
        type: button.type,
        text: button.text,
        url: button.url || undefined,
        phone_number: button.phoneNumber || undefined,
      })),
    });
  }

  if (templateType === 'CAROUSEL' && Array.isArray(template.carouselCards) && template.carouselCards.length > 0) {
    components.push({
      type: 'CAROUSEL',
      cards: template.carouselCards.slice(0, 10).map((card) => ({
        components: [
          {
            type: 'HEADER',
            format: String(card.mediaType || card.headerType || 'IMAGE').toUpperCase(),
            example: buildMediaExample(card.mediaUrl),
          },
          {
            type: 'BODY',
            text: String(card.body || card.title || 'Deal details').slice(0, 1024),
            ...(countTemplateVariables(String(card.body || card.title || 'Deal details').slice(0, 1024)) > 0
              && variableSamples.length >= countTemplateVariables(String(card.body || card.title || 'Deal details').slice(0, 1024))
              ? {
                  example: {
                    body_text: [variableSamples.slice(0, countTemplateVariables(String(card.body || card.title || 'Deal details').slice(0, 1024)))],
                  },
                }
              : {}),
          },
          {
            type: 'BUTTONS',
            buttons: (Array.isArray(card.buttons) && card.buttons.length ? card.buttons : [
              { type: 'QUICK_REPLY', text: 'Enquiry' },
              { type: 'QUICK_REPLY', text: 'See Others' },
            ]).slice(0, 2).map((button) => ({
              type: String(button.type || 'QUICK_REPLY').toUpperCase(),
              text: String(button.text || button.title || 'Select').slice(0, 25),
              url: button.url || undefined,
              phone_number: button.phoneNumber || button.phone_number || undefined,
            })),
          },
        ],
      })),
    });
  }

  return components;
}

function countTemplateVariables(text = '') {
  return new Set(String(text).match(/{{\s*\d+\s*}}/g) || []).size;
}

function getVariableMap(variables = []) {
  return variables.reduce((acc, value, index) => {
    acc[String(index + 1)] = value;
    return acc;
  }, {});
}

function extractPlaceholderIndexes(text = '') {
  const matches = String(text).match(/\{\{\s*\d+\s*\}\}/g) || [];
  return [...new Set(matches
    .map((token) => parseInt(token.replace(/[^\d]/g, ''), 10))
    .filter((value) => Number.isFinite(value))
    .sort((a, b) => a - b))];
}

function buildTextParameters(text, variableMap) {
  return extractPlaceholderIndexes(text)
    .map((index) => variableMap[String(index)])
    .filter((value) => value !== undefined && value !== null && String(value).trim() !== '')
    .map((value) => ({
      type: 'text',
      value: String(value),
      text: String(value),
    }));
}

function buildMediaParameter(mediaType, mediaUrl) {
  const type = String(mediaType || 'IMAGE').toLowerCase();
  const link = normalizeImageUrlForWhatsApp(mediaUrl);
  if (!link || !['image', 'video', 'document'].includes(type)) return null;

  return {
    type,
    [type]: { link },
  };
}

function buildStandardTemplateSendComponents(template, variableMap) {
  const components = [];
  const headerType = String(template.headerType || 'NONE').toUpperCase();

  if (headerType === 'TEXT') {
    const headerParameters = buildTextParameters(template.headerContent, variableMap);
    if (headerParameters.length > 0) {
      components.push({
        type: 'header',
        parameters: headerParameters,
      });
    }
  } else if (headerType !== 'NONE') {
    const mediaParameter = buildMediaParameter(headerType, template.headerContent);
    if (mediaParameter) {
      components.push({
        type: 'header',
        parameters: [mediaParameter],
      });
    }
  }

  const bodyParameters = buildTextParameters(template.body, variableMap);
  if (bodyParameters.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParameters,
    });
  }

  return components;
}

function buildTemplateSendComponents(template, variables = []) {
  if (!template) {
    return null;
  }

  const variableMap = getVariableMap(variables);
  const templateType = String(template.templateType || 'STANDARD').toUpperCase();

  if (templateType !== 'CAROUSEL') {
    const standardComponents = buildStandardTemplateSendComponents(template, variableMap);
    return standardComponents.length > 0 ? standardComponents : null;
  }

  const components = [];
  const bodyParameters = buildTextParameters(template.body, variableMap);

  if (bodyParameters.length > 0) {
    components.push({
      type: 'body',
      parameters: bodyParameters,
    });
  }

  const cards = Array.isArray(template.carouselCards)
    ? template.carouselCards.slice(0, 10).map((card, index) => {
        const cardComponents = [];
        const mediaParameter = buildMediaParameter(
          card.mediaType || card.headerType || 'IMAGE',
          card.mediaUrl || card.imageUrl || card.coverImageUrl
        );
        const cardBodyParameters = buildTextParameters(card.body, variableMap);

        if (mediaParameter) {
          cardComponents.push({
            type: 'header',
            parameters: [mediaParameter],
          });
        }

        if (cardBodyParameters.length > 0) {
          cardComponents.push({
            type: 'body',
            parameters: cardBodyParameters,
          });
        }

        return {
          cardIndex: index,
          components: cardComponents,
        };
      })
      .filter((card) => card.components.length > 0)
    : [];

  if (cards.length > 0) {
    components.push({
      type: 'carousel',
      cards,
    });
  }

  return components.length > 0 ? components : null;
}

async function upsertTemplateWithMeta(agencyId, template, { mode = 'upsert' } = {}) {
  const channel = await resolveAgencyChannel({ agencyId });

  if (canUseMarketingOs(channel)) {
    const tenantToken = await marketingOsPartnerService.getTenantToken(channel.marketingOsTenantId);
    const components = buildTemplateComponents(template);
    const payload = {
      id: template.id,
      name: template.name,
      templateName: template.name,
      template_name: template.name,
      category: template.category,
      useCase: 'CUSTOM',
      use_case: 'CUSTOM',
      language: template.language || 'en',
      status: template.status || 'DRAFT',
      headerType: template.headerType || 'NONE',
      header_type: template.headerType || 'NONE',
      headerContent: template.headerContent || null,
      header_content: template.headerContent || null,
      body: template.body,
      bodyContent: template.body,
      body_content: template.body,
      footer: template.footer || null,
      footerContent: template.footer || null,
      footer_content: template.footer || null,
      buttons: template.buttons || [],
      templateType: template.templateType || 'STANDARD',
      template_type: template.templateType || 'STANDARD',
      carouselCards: template.carouselCards || [],
      carousel_cards: template.carouselCards || [],
      components,
      variables: template.sampleVariables || [],
      triggerEvents: template.tags || [],
      trigger_events: template.tags || [],
    };

    if (mode === 'create') {
      return marketingOsPartnerService.createTenantWhatsAppTemplate(tenantToken, payload);
    }

    const providerTemplateId = template.metaTemplateId || template.meta_template_id || template.id;

    try {
      return await marketingOsPartnerService.updateTenantWhatsAppTemplate(tenantToken, providerTemplateId, payload);
    } catch (err) {
      const status = err.response?.status;
      if (status && status !== 404) throw err;
      return marketingOsPartnerService.createTenantWhatsAppTemplate(tenantToken, payload);
    }
  }

  if (canUseCloudApi(channel.phoneNumberId)) {
    throw new Error('Direct Meta template upsert not yet implemented in SELF_HOSTED mode');
  }

  throw new Error('No WhatsApp provider configured for template upsert');
}

async function submitTemplateToMeta(agencyId, template) {
  const channel = await resolveAgencyChannel({ agencyId });
  
  if (canUseMarketingOs(channel)) {
    const tenantToken = await marketingOsPartnerService.getTenantToken(channel.marketingOsTenantId);
    const providerTemplateId = template.metaTemplateId || template.meta_template_id || template.id;
    return await marketingOsPartnerService.submitTenantWhatsAppTemplate(tenantToken, providerTemplateId);
  }
  
  if (canUseCloudApi(channel.phoneNumberId)) {
     // Direct Meta submission would go here
    throw new Error('Direct Meta template submission not yet implemented in SELF_HOSTED mode');
  }
  
  throw new Error('No WhatsApp provider configured for template submission');
}

async function deleteTemplateFromMeta(agencyId, template) {
  const channel = await resolveAgencyChannel({ agencyId });

  if (canUseMarketingOs(channel)) {
    const tenantToken = await marketingOsPartnerService.getTenantToken(channel.marketingOsTenantId);
    const providerTemplateId = template.metaTemplateId || template.meta_template_id || template.id;
    return marketingOsPartnerService.deleteTenantWhatsAppTemplate(tenantToken, providerTemplateId);
  }

  if (canUseCloudApi(channel.phoneNumberId)) {
    throw new Error('Direct Meta template deletion not yet implemented in SELF_HOSTED mode');
  }

  throw new Error('No WhatsApp provider configured for template deletion');
}

module.exports = {
  sendTypingIndicator,
  waitForReplyPacing,
  sendProcessingPlaceholder,
  sendTextMessage,
  sendButtonsMessage,
  sendMediaButtonsMessage,
  sendListMessage,
  sendImageMessage,
  sendDocumentMessage,
  sendFlowMessage,
  sendTemplateMessage,
  sendTemplateOrTextIn24hWindow,
  isCustomerIn24hWindow,
  sendCatalogMessage,
  sendFallbackMessage,
  updateMessageStatus,
  markLatestCampaignReply,
  sendSystemNotificationWhatsApp,
  syncTemplatesWithMeta,
  upsertTemplateWithMeta,
  submitTemplateToMeta,
  deleteTemplateFromMeta,
};
