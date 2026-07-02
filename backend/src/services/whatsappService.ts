const axios = require('axios');
const { Op } = require('sequelize');
const { Agency, AgencyChannel, Campaign, CampaignRecipient, Customer, Message } = require('../models');
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

function inferDefaultCountryCode(channel = {}) {
  const agencyNumber = String(channel.whatsappDisplayPhoneNumber || channel.whatsappNumber || '').replace(/\D/g, '');
  if (agencyNumber.startsWith('971')) return '971';
  if (agencyNumber.startsWith('91')) return '91';
  return '91';
}

function normalizeRecipientPhone(phone, channel = {}) {
  const raw = String(phone || '').trim();
  if (!raw || raw.startsWith('ig_')) return raw;

  const compact = raw.replace(/[\s\-\(\)\.]/g, '');
  if (/^\+\d{8,15}$/.test(compact)) return compact;

  let digits = compact.replace(/\D/g, '');
  if (!digits) return raw;
  if (digits.startsWith('00') && digits.length > 10) digits = digits.slice(2);

  if (/^\d{11,15}$/.test(digits) && !digits.startsWith('0')) return `+${digits}`;

  const defaultCountryCode = inferDefaultCountryCode(channel);
  if (defaultCountryCode === '971') {
    if (/^0\d{8,10}$/.test(digits)) return `+971${digits.slice(1)}`;
    if (/^\d{9}$/.test(digits)) return `+971${digits}`;
  }

  return normalizePhone(raw) || raw;
}

function toMetaRecipient(phone, channel = {}) {
  return String(normalizeRecipientPhone(phone, channel) || '').replace(/^\+/, '').replace(/\D/g, '');
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
    || response?.data?.providerMessageId
    || response?.data?.provider_message_id
    || response?.data?.data?.providerMessageId
    || response?.data?.data?.provider_message_id
    || response?.data?.id
    || response?.data?.data?.messageId
    || response?.data?.messageId
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

  if (context.channelId) {
    const channel = await AgencyChannel.findOne({
      where: { id: context.channelId, agencyId: context.agencyId, isActive: true },
    });
    if (channel) {
      return {
        provider: channel.whatsappProvider || 'SELF_HOSTED',
        phoneNumberId: channel.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || null,
        marketingOsTenantId: channel.marketingOsTenantId || null,
        whatsappNumber: channel.whatsappNumber || null,
        whatsappDisplayPhoneNumber: channel.whatsappDisplayPhoneNumber || null,
        isInstagram: false,
      };
    }
  }

  let isInstagram = false;
  if (context.customerId) {
    const customer = await Customer.findOne({
      where: { id: context.customerId, agencyId: context.agencyId },
      attributes: ['id', 'phone', 'source', 'channelId'],
    });
    isInstagram = String(customer?.phone || '').startsWith('ig_')
      || String(customer?.source || '').toLowerCase() === 'instagram';

    if (customer?.channelId) {
      const channel = await AgencyChannel.findOne({
        where: { id: customer.channelId, agencyId: context.agencyId, isActive: true },
      });
      if (channel) {
        return {
          provider: channel.whatsappProvider || 'SELF_HOSTED',
          phoneNumberId: channel.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || null,
          marketingOsTenantId: channel.marketingOsTenantId || null,
          whatsappNumber: channel.whatsappNumber || null,
          whatsappDisplayPhoneNumber: channel.whatsappDisplayPhoneNumber || null,
          isInstagram,
        };
      }
    }
  }

  const defaultChannel = await AgencyChannel.findOne({
    where: { agencyId: context.agencyId, isDefault: true, isActive: true },
  });
  if (defaultChannel) {
    return {
      provider: defaultChannel.whatsappProvider || 'SELF_HOSTED',
      phoneNumberId: defaultChannel.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || null,
      marketingOsTenantId: defaultChannel.marketingOsTenantId || null,
      whatsappNumber: defaultChannel.whatsappNumber || null,
      whatsappDisplayPhoneNumber: defaultChannel.whatsappDisplayPhoneNumber || null,
      isInstagram,
    };
  }

  const agency = await Agency.findByPk(context.agencyId, {
    attributes: ['id', 'whatsappProvider', 'whatsappPhoneNumberId', 'marketingOsTenantId', 'whatsappNumber', 'whatsappDisplayPhoneNumber'],
  });

  return {
    provider: agency?.whatsappProvider || 'SELF_HOSTED',
    phoneNumberId: agency?.whatsappPhoneNumberId || process.env.WHATSAPP_PHONE_NUMBER_ID || null,
    marketingOsTenantId: agency?.marketingOsTenantId || null,
    whatsappNumber: agency?.whatsappNumber || null,
    whatsappDisplayPhoneNumber: agency?.whatsappDisplayPhoneNumber || null,
    isInstagram,
  };
}

async function sendViaMeta(phone, payload, phoneNumberId, channel = {}) {
  const client = getMetaClient(phoneNumberId);
  if (!client) {
    throw new Error('Meta Cloud API is not configured');
  }

  return client.post('/messages', {
    messaging_product: 'whatsapp',
    to: toMetaRecipient(phone, channel),
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
        to: toMetaRecipient(phone, channel),
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
    }, channel.phoneNumberId, channel);
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

async function sendViaMarketingOs(phone, payload, tenantId, channel = {}) {
  const idempotencyKey = `travelbot-${tenantId}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  const tenantToken = await marketingOsPartnerService.getTenantToken(tenantId);
  let data;

  const isInstagram = String(phone).startsWith('ig_');
  const instagramAddress = isInstagram ? String(phone).substring(3) : '';
  const separatorIndex = instagramAddress.indexOf(':');
  const instagramAccountId = separatorIndex > -1 ? instagramAddress.slice(0, separatorIndex) : null;
  const actualRecipient = isInstagram
    ? (separatorIndex > -1 ? instagramAddress.slice(separatorIndex + 1) : instagramAddress)
    : toMetaRecipient(phone, channel);

  if (isInstagram) {
    const igTarget = {
      tenantId,
      accountId: instagramAccountId || payload.accountId,
      recipientId: actualRecipient,
    };

    if (payload.type === 'media') {
      // Instagram natively supports image / video / audio attachments from a hosted URL.
      // Documents (PDFs) aren't supported as attachments, so they go out as a captioned link.
      const mediaType = String(payload.mediaType || 'image').toLowerCase();
      if (mediaType === 'image' || mediaType === 'video' || mediaType === 'audio') {
        data = await marketingOsPartnerService.sendTenantInstagramMessage(tenantToken, {
          ...igTarget,
          mediaUrl: payload.mediaUrl,
          mediaType,
          caption: payload.caption || '',
        });
      } else {
        const linkText = [payload.caption, payload.fileName || payload.filename, payload.mediaUrl]
          .filter(Boolean)
          .join('\n');
        data = await marketingOsPartnerService.sendTenantInstagramMessage(tenantToken, {
          ...igTarget,
          text: linkText,
        });
      }
    } else if (payload.type === 'cards') {
      // Generic-template carousel: image + title + subtitle + buttons, all in one card unit.
      data = await marketingOsPartnerService.sendTenantInstagramMessage(tenantToken, {
        ...igTarget,
        cards: payload.cards,
      });
    } else {
      // Map WhatsApp-style interactives onto native Instagram messaging primitives:
      //  - BUTTON / LIST  -> quick-reply chips (their payload echoes back as the inbound
      //    actionId, so taps round-trip through the flow engine natively).
      //  - CTA_URL        -> a button template carrying a web_url button.
      // Lists with more options than Instagram allows (13 chips), and any other type, fall
      // back to the readable numbered-text menu so nothing is silently dropped.
      const ig = buildInstagramInteractive(payload);

      // If the interactive carried an image header (media + buttons), send the image first
      // as its own attachment so the picture is never lost, then the chips/text.
      if (ig.imageUrl) {
        await marketingOsPartnerService.sendTenantInstagramMessage(tenantToken, {
          ...igTarget,
          mediaUrl: ig.imageUrl,
          mediaType: 'image',
        });
      }

      data = await marketingOsPartnerService.sendTenantInstagramMessage(tenantToken, {
        ...igTarget,
        text: ig.text,
        ...(ig.quickReplies ? { quickReplies: ig.quickReplies } : {}),
        ...(ig.buttons ? { buttons: ig.buttons } : {}),
      });
    }
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
      fileName: payload.fileName || payload.filename,
      filename: payload.filename || payload.fileName,
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

function renderUrlButtonFallback(body, buttonText, url, options = {}) {
  const header = options.headerText ? `*${options.headerText}*\n` : '';
  const footer = options.footerText ? `\n${options.footerText}` : '';
  // Include the actual URL so the message is still tappable on channels that do not render a
  // native CTA button (WhatsApp auto-links the wa.me/https URL in plain text).
  const cta = url ? `👉 ${buttonText}: ${url}` : buttonText;
  return `${header}${body}\n\n${cta}${footer}`.trim();
}

/**
 * Renders a Marketing OS `interactiveContent` payload (BUTTON / LIST / CTA_URL) into a
 * plain numbered-text string. Channels that do not support native interactives — notably
 * Instagram DMs via Marketing OS — fall back to this so users see a readable menu instead
 * of a raw JSON dump. The numbering matches what the reply parser expects (numeric replies
 * select an option by index).
 */
function renderInteractiveContentFallback(interactiveContent) {
  if (!interactiveContent || typeof interactiveContent !== 'object') return '';
  const header = interactiveContent.header ? `*${interactiveContent.header}*\n` : '';
  const footer = interactiveContent.footer ? `\n${interactiveContent.footer}` : '';
  const body = interactiveContent.body || '';

  if (interactiveContent.type === 'BUTTON' && Array.isArray(interactiveContent.buttons)) {
    const lines = interactiveContent.buttons
      .map((button, index) => `${index + 1}. ${button.title}`)
      .join('\n');
    return `${header}${body}\n\n${lines}${footer}`.trim();
  }

  if (interactiveContent.type === 'LIST' && Array.isArray(interactiveContent.sections)) {
    // Mirror renderListFallback exactly (per-section numbering) so the numbers shown match
    // what the bot's numeric reply parser expects.
    const sectionText = interactiveContent.sections.map((section) => {
      const lines = (section.rows || []).map((row, index) =>
        `${index + 1}. ${row.title}${row.description ? ` - ${row.description}` : ''}`).join('\n');
      return section.title ? `*${section.title}*\n${lines}` : lines;
    }).join('\n\n');
    return `${header}${body}\n\n${sectionText}${footer}`.trim();
  }

  if (interactiveContent.type === 'CTA_URL') {
    const cta = interactiveContent.button?.title
      || interactiveContent.action?.parameters?.display_text
      || '';
    const url = interactiveContent.button?.url
      || interactiveContent.action?.parameters?.url
      || '';
    return `${header}${body}\n\n${cta}${url ? `: ${url}` : ''}${footer}`.trim();
  }

  return `${header}${body}${footer}`.trim();
}

// Instagram messaging caps quick-reply chips at 13.
const MAX_IG_QUICK_REPLIES = 13;

/**
 * Translates an outbound payload into native Instagram messaging primitives. Returns the
 * message text plus, when applicable, `quickReplies` (BUTTON/LIST options as tappable chips)
 * or `buttons` (a CTA_URL link). Each chip's payload is the option id the flow engine encodes
 * (e.g. `flow_graph:node:option`), so a tap echoes back as the inbound actionId and routes
 * exactly like a WhatsApp reply button. Anything that can't map natively — non-interactive
 * sends, or lists longer than Instagram allows — falls back to the numbered-text menu.
 */
function buildInstagramInteractive(payload = {}) {
  const fallbackText = payload.content
    || payload.text
    || (payload.type === 'interactive' ? renderInteractiveContentFallback(payload.interactiveContent) : '')
    || payload.caption
    || payload.mediaUrl
    || '';

  if (payload.type !== 'interactive' || !payload.interactiveContent) {
    return { text: fallbackText };
  }

  const ic = payload.interactiveContent;
  const body = ic.body || fallbackText || 'Please choose an option.';

  if (ic.type === 'BUTTON' && Array.isArray(ic.buttons) && ic.buttons.length) {
    // A media header (image + buttons) can't ride on an Instagram quick-reply message, so
    // surface its URL — the caller sends it as a separate image attachment first.
    const headerImageUrl = ic.header && typeof ic.header === 'object'
      && (ic.header.type === 'image' || ic.header.imageUrl)
      ? (ic.header.imageUrl || ic.header.url)
      : undefined;
    return {
      text: body,
      quickReplies: ic.buttons.slice(0, MAX_IG_QUICK_REPLIES).map((button) => ({
        title: button.title,
        payload: button.id,
      })),
      ...(headerImageUrl ? { imageUrl: headerImageUrl } : {}),
    };
  }

  if (ic.type === 'LIST' && Array.isArray(ic.sections)) {
    const rows = ic.sections.flatMap((section) => (Array.isArray(section.rows) ? section.rows : []));
    // Only use chips when every option fits; otherwise keep the full numbered-text menu.
    if (rows.length && rows.length <= MAX_IG_QUICK_REPLIES) {
      return {
        text: body,
        quickReplies: rows.map((row) => ({ title: row.title, payload: row.id })),
      };
    }
    return { text: fallbackText };
  }

  if (ic.type === 'CTA_URL') {
    const title = ic.button?.title || ic.action?.parameters?.display_text || 'Open';
    const url = ic.button?.url || ic.action?.parameters?.url || '';
    if (url) {
      return { text: ic.body || fallbackText, buttons: [{ title, url }] };
    }
    return { text: fallbackText };
  }

  return { text: fallbackText };
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

  const cloudinaryImageTransform = 'w_800,h_600,c_limit,f_jpg,q_auto';
  const uploadMarker = '/image/upload/';
  const afterUpload = url.split(uploadMarker)[1] || '';
  const firstSegment = afterUpload.split('/')[0] || '';
  const alreadyTransformed = firstSegment.includes(',') || /^f_(jpg|png|webp|auto)(?:,|$)/i.test(firstSegment);

  if (!alreadyTransformed) {
    return url.replace(uploadMarker, `${uploadMarker}${cloudinaryImageTransform}/`);
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
      }, channel.marketingOsTenantId, channel);
      return markMessageSent(message, response);
    }

    if (canUseCloudApi(channel.phoneNumberId)) {
      const response = await sendViaMeta(phone, {
        type: 'text',
        text: {
          preview_url: false,
          body: content,
        },
      }, channel.phoneNumberId, channel);
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
        content: fallbackContent,
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
      }, channel.marketingOsTenantId, channel);
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
    }, channel.phoneNumberId, channel);

    return markMessageSent(message, response);
  } catch (err) {
    return markMessageFailed(message, 'sendButtonsMessage', err);
  }
}

async function sendUrlButtonMessage(phone, body, buttonText, url, context, options = {}) {
  const safeButtonText = String(buttonText || 'Open Link').trim().slice(0, 20) || 'Open Link';
  const safeUrl = String(url || '').trim();
  if (!safeUrl) return sendTextMessage(phone, body, context);

  const fallbackContent = renderUrlButtonFallback(body, safeButtonText, safeUrl, options);
  const channel = await resolveAgencyChannel(context);

  if (canUseMarketingOs(channel)) {
    const message = await createOutboundMessage(context, {
      content: fallbackContent,
      type: 'TEXT',
    });

    try {
      const response = await sendViaMarketingOs(phone, {
        type: 'interactive',
        content: fallbackContent,
        interactiveContent: {
          type: 'CTA_URL',
          header: options.headerText,
          body,
          footer: options.footerText,
          action: {
            name: 'cta_url',
            parameters: {
              display_text: safeButtonText,
              url: safeUrl,
            },
          },
          button: {
            title: safeButtonText,
            url: safeUrl,
          },
        },
      }, channel.marketingOsTenantId, channel);
      return markMessageSent(message, response);
    } catch (err) {
      await markMessageFailed(message, 'sendUrlButtonMessage', err);
      return sendTextMessage(phone, fallbackContent, context);
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
        type: 'cta_url',
        header: options.headerText ? { type: 'text', text: options.headerText } : undefined,
        body: { text: body },
        footer: options.footerText ? { text: options.footerText } : undefined,
        action: {
          name: 'cta_url',
          parameters: {
            display_text: safeButtonText,
            url: safeUrl,
          },
        },
      },
    }, channel.phoneNumberId, channel);

    return markMessageSent(message, response);
  } catch (err) {
    await markMessageFailed(message, 'sendUrlButtonMessage', err);
    return sendTextMessage(phone, fallbackContent, context);
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
        content: fallbackContent,
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
      }, channel.marketingOsTenantId, channel);
      return markMessageSent(message, response);
    } catch (err) {
      await markMessageFailed(message, 'sendMediaButtonsMessage', err);
      return sendTextMessage(phone, fallbackContent, context);
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
    }, channel.phoneNumberId, channel);

    return markMessageSent(message, response);
  } catch (err) {
    await markMessageFailed(message, 'sendMediaButtonsMessage', err);
    return sendTextMessage(phone, fallbackContent, context);
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
        content: fallbackContent,
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
      }, channel.marketingOsTenantId, channel);
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
    }, channel.phoneNumberId, channel);

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
      }, channel.marketingOsTenantId, channel);
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
    }, channel.phoneNumberId, channel);

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
        fileName: safeFilename,
        filename: safeFilename,
      }, channel.marketingOsTenantId, channel);
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
    }, channel.phoneNumberId, channel);

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
      }, channel.marketingOsTenantId, channel);

      return markMessageSent(message, response);
    } catch (err) {
      console.error('[WhatsAppService] sendFlowMessage failed via Marketing OS:', {
        tenantId: channel.marketingOsTenantId,
        flowId,
        flowName,
        firstScreenId,
        error: err?.response?.data || err?.message || err,
      });
      return markMessageFailed(message, 'sendFlowMessage', err);
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
    }, channel.phoneNumberId, channel);

    return markMessageSent(message, response);
  } catch (err) {
    console.error('[WhatsAppService] sendFlowMessage failed via Cloud API:', {
      phoneNumberId: channel.phoneNumberId,
      flowId,
      flowName,
      firstScreenId,
      error: err?.response?.data || err?.message || err,
    });
    return markMessageFailed(message, 'sendFlowMessage', err);
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
      }, channel.marketingOsTenantId, channel);

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
      }, channel.marketingOsTenantId, channel);

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
    }, channel.phoneNumberId, channel);

    return markMessageSent(message, response);
  } catch (err) {
    return markMessageFailed(message, 'sendCatalogMessage', err);
  }
}

function getStatusErrorMessage(statusEvent = {}) {
  const errors = Array.isArray(statusEvent.errors) ? statusEvent.errors : [];
  if (!errors.length) return null;

  return errors.map((error) => {
    const code = error.code ? `${error.code}: ` : '';
    const message = error.message || error.title || error.error_data?.details || 'Webhook reported failure';
    return `${code}${message}`;
  }).join('; ').slice(0, 500);
}

async function updateMessageStatus(waMessageId, newStatus, statusEvent = {}) {
  if (!waMessageId) return;

  const statusMap = {
    delivered: 'DELIVERED',
    read: 'READ',
    played: 'READ',
    failed: 'FAILED',
    sent: 'SENT',
  };

  const normalizedStatus = String(newStatus || '').trim().toLowerCase();
  const status = statusMap[normalizedStatus];
  if (!status) {
    console.warn('[WhatsAppService] Ignoring unsupported message status:', newStatus);
    return;
  }

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
    recipientUpdates.errorMessage = getStatusErrorMessage(statusEvent) || 'Webhook reported failure';
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

  const [sent, delivered, read, replied, failed, total] = await Promise.all([
    CampaignRecipient.count({ where: { campaignId, status: { [Op.in]: ['SENT', 'DELIVERED', 'READ', 'REPLIED'] } } }),
    CampaignRecipient.count({ where: { campaignId, status: { [Op.in]: ['DELIVERED', 'READ', 'REPLIED'] } } }),
    CampaignRecipient.count({ where: { campaignId, status: { [Op.in]: ['READ', 'REPLIED'] } } }),
    CampaignRecipient.count({ where: { campaignId, status: 'REPLIED' } }),
    CampaignRecipient.count({ where: { campaignId, status: 'FAILED' } }),
    CampaignRecipient.count({ where: { campaignId } }),
  ]);

  const campaignUpdates = { sent, delivered, read, replied, failed };
  const campaign = await Campaign.findByPk(campaignId);

  if (campaign && !['DRAFT', 'SCHEDULED', 'CANCELLED'].includes(campaign.status)) {
    const activeCount = sent + delivered + read + replied;
    if (total > 0 && failed >= total) {
      campaignUpdates.status = 'FAILED';
    } else if (activeCount > 0 && campaign.status === 'FAILED') {
      campaignUpdates.status = 'SENT';
    }
  }

  await Campaign.update(
    campaignUpdates,
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
      }, channel.marketingOsTenantId, channel);
    }

    if (canUseCloudApi(channel.phoneNumberId)) {
      return await sendViaMeta(phone, {
        type: 'text',
        text: {
          preview_url: false,
          body: content,
        },
      }, channel.phoneNumberId, channel);
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
  const buildTemplateButton = (button = {}) => {
    const type = String(button.type || 'QUICK_REPLY').toUpperCase();
    const base = {
      type,
      text: String(button.text || button.title || 'Continue').slice(0, 25),
    };

    if (type === 'URL') {
      return {
        ...base,
        url: button.url || undefined,
      };
    }

    if (type === 'PHONE_NUMBER') {
      return {
        ...base,
        phone_number: button.phoneNumber || button.phone_number || undefined,
      };
    }

    if (type === 'FLOW') {
      return {
        ...base,
        flow_id: button.flowId || button.flow_id || undefined,
        flow_name: button.flowName || button.flow_name || undefined,
        flow_json: button.flowJson || button.flow_json || undefined,
        flow_action: button.flowAction || button.flow_action || 'navigate',
        navigate_screen: button.navigateScreen || button.navigate_screen || undefined,
      };
    }

    return base;
  };
  const getPlaceholderIndexes = (text = '') => {
    const matches = String(text || '').match(/\{\{\s*\d+\s*\}\}/g) || [];
    return [...new Set(matches
      .map((token) => parseInt(token.replace(/[^\d]/g, ''), 10))
      .filter((value) => Number.isFinite(value) && value > 0))]
      .sort((a, b) => a - b);
  };
  const getSampleValue = (position) => {
    const sample = variableSamples[position - 1];
    return sample !== undefined && sample !== null && String(sample).trim()
      ? String(sample)
      : `Sample ${position}`;
  };
  const buildTextExample = (text = '') => {
    const indexes = getPlaceholderIndexes(text);
    return indexes.length ? indexes.map(getSampleValue) : null;
  };

  if (templateType !== 'CAROUSEL' && headerType !== 'NONE') {
    const header = { type: 'HEADER', format: headerType };
    if (headerType === 'TEXT') {
      header.text = template.headerContent || '';
      const headerExample = buildTextExample(header.text);
      if (headerExample) {
        header.example = { header_text: [headerExample[0]] };
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
  const bodyExample = buildTextExample(body.text);
  if (bodyExample) {
    body.example = { body_text: [bodyExample] };
  }
  components.push(body);

  if (templateType !== 'CAROUSEL' && template.footer) {
    components.push({ type: 'FOOTER', text: template.footer });
  }

  if (templateType !== 'CAROUSEL' && Array.isArray(template.buttons) && template.buttons.length > 0) {
    components.push({
      type: 'BUTTONS',
      buttons: template.buttons.map(buildTemplateButton),
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
            ...(buildTextExample(String(card.body || card.title || 'Deal details').slice(0, 1024))
              ? {
                  example: {
                    body_text: [buildTextExample(String(card.body || card.title || 'Deal details').slice(0, 1024))],
                  },
                }
              : {}),
          },
          {
            type: 'BUTTONS',
            buttons: (Array.isArray(card.buttons) && card.buttons.length ? card.buttons : [
              { type: 'QUICK_REPLY', text: 'Enquiry' },
              { type: 'QUICK_REPLY', text: 'See Others' },
            ]).slice(0, 2).map(buildTemplateButton),
          },
        ],
      })),
    });
  }

  return components;
}

function stripTemplateButtonRouting(button = {}) {
  const { route, action, routing, ...metaButton } = button || {};
  return metaButton;
}

function stripTemplateRouting(template) {
  const source = template?.get ? template.get({ plain: true }) : template;
  return {
    ...source,
    buttons: Array.isArray(source.buttons) ? source.buttons.map(stripTemplateButtonRouting) : [],
    carouselCards: Array.isArray(source.carouselCards)
      ? source.carouselCards.map((card) => ({
          ...card,
          buttons: Array.isArray(card.buttons) ? card.buttons.map(stripTemplateButtonRouting) : [],
        }))
      : [],
  };
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

function buildMediaParameter(mediaType, mediaUrl, filename) {
  const type = String(mediaType || 'IMAGE').toLowerCase();
  const link = normalizeImageUrlForWhatsApp(mediaUrl);
  if (!link || !['image', 'video', 'document'].includes(type)) return null;

  const media = { link };
  // WhatsApp lets a document header carry a display filename for the customer.
  if (type === 'document' && String(filename || '').trim()) {
    media.filename = String(filename).trim();
  }

  return {
    type,
    [type]: media,
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
    const mediaParameter = buildMediaParameter(headerType, template.headerContent, template.headerFilename);
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

  const flowButtonIndex = Array.isArray(template.buttons)
    ? template.buttons.findIndex((button) => String(button.type || '').toUpperCase() === 'FLOW')
    : -1;

  if (flowButtonIndex > -1) {
    const flowButton = template.buttons[flowButtonIndex] || {};
    components.push({
      type: 'button',
      sub_type: 'flow',
      index: String(flowButtonIndex),
      parameters: [{
        type: 'action',
        action: {
          flow_token: flowButton.flowToken || flowButton.flow_token || `review-template-${Date.now()}`,
          flow_action_data: flowButton.flowActionData || flowButton.flow_action_data || {},
        },
      }],
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
        // Each carousel card has its OWN {{n}} variables (numbered per card), so use
        // this card's values when provided — otherwise fall back to the shared map.
        // This is what lets every card show a distinct, agency-written description.
        const cardVariableMap = Array.isArray(card.bodyVariables) && card.bodyVariables.length
          ? getVariableMap(card.bodyVariables)
          : variableMap;
        const cardBodyParameters = buildTextParameters(card.body, cardVariableMap);

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
    const providerTemplate = stripTemplateRouting(template);
    const components = buildTemplateComponents(providerTemplate);
    const payload = {
      id: providerTemplate.id,
      name: providerTemplate.name,
      templateName: providerTemplate.name,
      template_name: providerTemplate.name,
      category: providerTemplate.category,
      useCase: 'CUSTOM',
      use_case: 'CUSTOM',
      language: providerTemplate.language || 'en',
      status: providerTemplate.status || 'DRAFT',
      headerType: providerTemplate.headerType || 'NONE',
      header_type: providerTemplate.headerType || 'NONE',
      headerContent: providerTemplate.headerContent || null,
      header_content: providerTemplate.headerContent || null,
      body: providerTemplate.body,
      bodyContent: providerTemplate.body,
      body_content: providerTemplate.body,
      footer: providerTemplate.footer || null,
      footerContent: providerTemplate.footer || null,
      footer_content: providerTemplate.footer || null,
      buttons: providerTemplate.buttons || [],
      templateType: providerTemplate.templateType || 'STANDARD',
      template_type: providerTemplate.templateType || 'STANDARD',
      carouselCards: providerTemplate.carouselCards || [],
      carousel_cards: providerTemplate.carouselCards || [],
      components,
      variables: providerTemplate.sampleVariables || [],
      triggerEvents: providerTemplate.tags || [],
      trigger_events: providerTemplate.tags || [],
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

/**
 * Send a carousel of generic-template cards (image + title + subtitle + buttons) on Instagram.
 * Instagram-only — if the channel isn't an IG Marketing OS channel, falls back to plain text so
 * callers never have to branch. `cards` items: { title, subtitle, imageUrl, buttons:[{title,url}] }.
 */
async function sendInstagramCards(phone, cards, context, options = {}) {
  const list = Array.isArray(cards) ? cards.filter(Boolean) : [];
  const channel = await resolveAgencyChannel(context);
  const isInstagram = String(phone).startsWith('ig_');

  if (!list.length) return null;

  if (!isInstagram || !canUseMarketingOs(channel)) {
    // Non-Instagram safety net: render the cards as a numbered text summary.
    const text = list.map((c, i) => `${i + 1}. ${c.title || ''}${c.subtitle ? ` - ${c.subtitle}` : ''}`).join('\n');
    return sendTextMessage(phone, text, context);
  }

  const message = await createOutboundMessage(context, {
    content: `[${list.length} cards]`,
    type: 'TEXT',
  });

  try {
    const response = await sendViaMarketingOs(phone, {
      type: 'cards',
      cards: list,
    }, channel.marketingOsTenantId, channel);
    return markMessageSent(message, response);
  } catch (err) {
    return markMessageFailed(message, 'sendInstagramCards', err);
  }
}

module.exports = {
  sendTypingIndicator,
  waitForReplyPacing,
  sendProcessingPlaceholder,
  sendTextMessage,
  sendButtonsMessage,
  sendUrlButtonMessage,
  sendMediaButtonsMessage,
  sendListMessage,
  sendInstagramCards,
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
