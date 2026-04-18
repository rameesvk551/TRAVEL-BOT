const axios = require('axios');
const { Agency, Message } = require('../models');
const marketingOsPartnerService = require('./marketingOsPartnerService');

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

async function resolveAgencyChannel(context = {}) {
  if (!context?.agencyId) {
    return {
      provider: 'SELF_HOSTED',
      phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID || null,
      marketingOsTenantId: null,
    };
  }

  const agency = await Agency.findByPk(context.agencyId, {
    attributes: ['id', 'whatsappProvider', 'whatsappPhoneNumberId', 'marketingOsTenantId'],
  });

  return {
    provider: agency?.whatsappProvider || 'SELF_HOSTED',
    phoneNumberId: agency?.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || null,
    marketingOsTenantId: agency?.marketingOsTenantId || null,
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
  return channel?.provider === 'MARKETING_OS' && !!channel?.marketingOsTenantId;
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

  if (payload.type === 'template') {
    data = await marketingOsPartnerService.sendTenantWhatsAppMessage(tenantToken, {
      tenantId,
      to: toMetaRecipient(phone),
      body: `[Template: ${payload.templateName}]`,
      templateName: payload.templateName,
      language: payload.languageCode || 'en',
      variables: payload.variables || {},
      idempotencyKey,
    });
  } else if (payload.type === 'interactive') {
    data = await marketingOsPartnerService.sendTenantWhatsAppInteractive(tenantToken, {
      tenantId,
      to: toMetaRecipient(phone),
      recipientPhone: toMetaRecipient(phone),
      interactiveContent: payload.interactiveContent,
      idempotencyKey,
    });
  } else if (payload.type === 'media') {
    data = await marketingOsPartnerService.sendTenantWhatsAppMedia(tenantToken, {
      tenantId,
      to: toMetaRecipient(phone),
      recipientPhone: toMetaRecipient(phone),
      mediaUrl: payload.mediaUrl,
      caption: payload.caption,
      mediaType: payload.mediaType || 'image',
      mimeType: payload.mimeType,
      idempotencyKey,
    });
  } else {
    data = await marketingOsPartnerService.sendTenantWhatsAppMessage(tenantToken, {
      tenantId,
      to: toMetaRecipient(phone),
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

  const isCloudinarySvg = url.includes('res.cloudinary.com')
    && url.includes('/image/upload/')
    && /\.svg(?:\?|$)/i.test(url);

  if (!isCloudinarySvg) {
    return url;
  }

  return url
    .replace('/image/upload/', '/image/upload/f_png/')
    .replace(/\.svg(\?|$)/i, '.png$1');
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

async function sendTemplateMessage(phone, templateName, variables, context) {
  const content = `[Template: ${templateName}] ${variables.join(', ')}`;
  const channel = await resolveAgencyChannel(context);

  if (canUseMarketingOs(channel)) {
    const message = await createOutboundMessage(context, {
      content,
      type: 'TEMPLATE',
      templateName,
    });

    try {
      const response = await sendViaMarketingOs(phone, {
        type: 'template',
        templateName,
        languageCode: 'en',
        variables: variables.reduce((acc, value, index) => {
          acc[String(index + 1)] = value;
          return acc;
        }, {}),
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
  sendCatalogMessage,
  sendFallbackMessage,
  updateMessageStatus,
  sendSystemNotificationWhatsApp,
};
