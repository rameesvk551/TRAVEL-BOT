const axios = require('axios');
const { Agency, Message } = require('../models');

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
  const waMessageId = response?.data?.messages?.[0]?.id || response?.data?.id || null;
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
    };
  }

  const agency = await Agency.findByPk(context.agencyId, {
    attributes: ['id', 'whatsappProvider', 'whatsappPhoneNumberId'],
  });

  return {
    provider: agency?.whatsappProvider || 'SELF_HOSTED',
    phoneNumberId: agency?.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || null,
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

async function sendTextMessage(phone, content, context) {
  const message = await createOutboundMessage(context, {
    content,
    type: 'TEXT',
  });

  try {
    const channel = await resolveAgencyChannel(context);

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

async function sendListMessage(phone, body, buttonText, sections, context, options = {}) {
  const fallbackContent = renderListFallback(body, sections, options);
  const channel = await resolveAgencyChannel(context);

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
  const fallbackContent = caption ? `${caption}\n${imageUrl}` : imageUrl;
  const channel = await resolveAgencyChannel(context);

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
        link: imageUrl,
        caption: caption || undefined,
      },
    }, channel.phoneNumberId);

    return markMessageSent(message, response);
  } catch (err) {
    return markMessageFailed(message, 'sendImageMessage', err);
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
    return markMessageFailed(message, 'sendFlowMessage', err);
  }
}

async function sendTemplateMessage(phone, templateName, variables, context) {
  const content = `[Template: ${templateName}] ${variables.join(', ')}`;

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

module.exports = {
  sendTextMessage,
  sendButtonsMessage,
  sendListMessage,
  sendImageMessage,
  sendFlowMessage,
  sendTemplateMessage,
  sendFallbackMessage,
  updateMessageStatus,
};
