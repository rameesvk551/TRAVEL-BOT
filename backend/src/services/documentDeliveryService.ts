// FILE: /backend/src/services/documentDeliveryService.ts
//
// Generates a document PDF, hosts it (Cloudinary / public web root) and sends it
// to the customer over WhatsApp. Used both by the manual "Send to WhatsApp"
// endpoints and by the automatic triggers (booking created, quotation marked
// SENT, invoice generated, receipt on payment PAID). The per-agency on/off
// switches and the selected Meta template live in Agency.documentSettings:
//   { autoSend: { booking, quotation, invoice, receipt, itinerary },
//     captions:  { ...plain-PDF fallback captions... },
//     templates: { booking, quotation, invoice, receipt } }  // MessageTemplate ids
//
// Delivery strategy per doc type:
//   • If an APPROVED Meta template is selected for the doc type, send it as an
//     approved template message with the generated PDF attached as the DOCUMENT
//     header (compliant proactive notification).
//   • Otherwise fall back to a plain document message + caption (24h window only).

const documentPdfService = require('./documentPdfService');
const mediaService = require('./mediaService');
const whatsappService = require('./whatsappService');
const { MessageTemplate, Booking, Customer } = require('../models');

const DEFAULT_CAPTIONS = {
  quotation: 'Here is your quotation. Please review and let us know if you have any questions.',
  invoice: 'Please find your invoice attached.',
  receipt: 'Thank you! Your payment receipt is attached.',
  itinerary: 'Here is your travel itinerary. We hope you love the plan — let us know if you have any questions!',
};

function getDocumentSettings(agency) {
  return (agency && (agency.documentSettings || (agency.get && agency.get('documentSettings')))) || {};
}

/** Reads the auto-send toggle for a doc type from an agency record. */
function isAutoSendEnabled(agency, docType) {
  const autoSend = getDocumentSettings(agency).autoSend || {};
  return autoSend[docType] === true;
}

function captionFor(agency, docType) {
  const captions = getDocumentSettings(agency).captions || {};
  return captions[docType] || DEFAULT_CAPTIONS[docType] || '';
}

/** The MessageTemplate id the agency picked for a doc type, if any. */
function selectedTemplateId(agency, docType) {
  const templates = getDocumentSettings(agency).templates || {};
  return templates[docType] || null;
}

/**
 * Resolves the agency's selected template for a doc type, but only when it is
 * APPROVED by Meta (an un-approved template cannot be sent proactively).
 */
async function resolveApprovedTemplate(agency, docType) {
  const templateId = selectedTemplateId(agency, docType);
  if (!templateId) return null;
  const agencyId = agency.id || agency.get?.('id');
  const template = await MessageTemplate.findOne({ where: { id: templateId, agencyId } });
  if (!template || String(template.status || '').toUpperCase() !== 'APPROVED') return null;
  return template;
}

function countPlaceholders(body) {
  const matches = String(body || '').match(/\{\{\s*(\d+)\s*\}\}/g) || [];
  return matches.reduce((max, token) => {
    const value = parseInt(token.replace(/[^\d]/g, ''), 10);
    return Number.isFinite(value) ? Math.max(max, value) : max;
  }, 0);
}

/**
 * Builds positional body variables for a template send. Position 1 is the
 * customer name (the convention used by the document templates); any further
 * positions fall back to the template's stored sample values so the message is
 * always complete for an arbitrary agency template.
 */
function buildTemplateVariables(template, customerName) {
  const samples = Array.isArray(template.sampleVariables) ? template.sampleVariables : [];
  const count = countPlaceholders(template.body);
  const variables = [];
  for (let i = 0; i < count; i += 1) {
    if (i === 0) {
      variables.push(String(customerName || samples[0] || 'there'));
    } else {
      variables.push(samples[i] !== undefined && samples[i] !== null ? String(samples[i]) : '');
    }
  }
  return variables;
}

/**
 * Sends an already-uploaded document PDF to the customer, choosing the approved
 * Meta template path when one is configured, else the plain document message.
 * Shared by the quotation/receipt/itinerary generators and the invoice trigger.
 */
async function sendUploadedDocument({ docType, agency, recipient, agentId, url, filename }) {
  if (!recipient || !recipient.phone) {
    throw Object.assign(new Error('Customer has no WhatsApp number'), { statusCode: 400, code: 'NO_RECIPIENT_PHONE' });
  }
  const agencyId = agency.id || agency.get?.('id');
  const context = { customerId: recipient.customerId, agencyId, agentId: agentId || null };

  const template = await resolveApprovedTemplate(agency, docType);
  if (template) {
    // Attach the freshly generated PDF as the template's DOCUMENT header.
    const sendTemplate = {
      ...template.toJSON(),
      headerType: 'DOCUMENT',
      headerContent: url,
      headerFilename: filename,
    };
    const variables = buildTemplateVariables(template, recipient.name);
    const message = await whatsappService.sendTemplateMessage(
      recipient.phone,
      template.name,
      variables,
      context,
      { template: sendTemplate },
    );
    return { url, filename, via: 'template', templateName: template.name, message };
  }

  const caption = captionFor(agency, docType);
  const message = await whatsappService.sendDocumentMessage(recipient.phone, url, filename, caption, context);
  return { url, filename, via: 'document', message };
}

async function deliver({ docType, generated, agency, agentId }) {
  const { buffer, filename, ref, recipient } = generated;
  if (!recipient || !recipient.phone) {
    throw Object.assign(new Error('Customer has no WhatsApp number'), { statusCode: 400, code: 'NO_RECIPIENT_PHONE' });
  }

  const uploaded = await mediaService.uploadDocumentPdf(buffer, agency.id || agency.get?.('id'), docType, ref);
  return sendUploadedDocument({ docType, agency, recipient, agentId, url: uploaded.secureUrl, filename });
}

/** Generate + send a quotation PDF. */
async function sendQuotation(quotationId, agency, { agentId } = {}) {
  const generated = await documentPdfService.generateQuotationPdf(quotationId, agency.id || agency.get?.('id'));
  return deliver({ docType: 'quotation', generated, agency, agentId });
}

/** Generate + send a payment receipt PDF. */
async function sendReceiptForPayment(paymentId, agency, { agentId } = {}) {
  const generated = await documentPdfService.generateReceiptPdf(paymentId, agency.id || agency.get?.('id'));
  return deliver({ docType: 'receipt', generated, agency, agentId });
}

/** Generate + send an itinerary PDF. */
async function sendItinerary(itineraryId, agency, { agentId } = {}) {
  const generated = await documentPdfService.generateItineraryPdf(itineraryId, agency.id || agency.get?.('id'));
  return deliver({ docType: 'itinerary', generated, agency, agentId });
}

/**
 * Send the agency's selected Booking Confirmation template to the customer.
 * Unlike the document types this carries no PDF — it is a plain approved
 * template (usually a text/image confirmation). No-ops (returns a skip reason)
 * when no approved template is selected or the customer has no phone.
 */
async function sendBookingConfirmation(bookingId, agency, { agentId } = {}) {
  const agencyId = agency.id || agency.get?.('id');
  const template = await resolveApprovedTemplate(agency, 'booking');
  if (!template) return { skipped: true, reason: 'no-approved-template' };

  const booking = await Booking.findOne({ where: { id: bookingId, agencyId } });
  if (!booking) return { skipped: true, reason: 'booking-not-found' };

  const customer = await Customer.findByPk(booking.customerId);
  if (!customer || !customer.phone) return { skipped: true, reason: 'no-recipient-phone' };

  const variables = buildTemplateVariables(template, customer.name);
  const context = { customerId: booking.customerId, agencyId, agentId: agentId || null };
  const message = await whatsappService.sendTemplateMessage(
    customer.phone,
    template.name,
    variables,
    context,
    { template: template.toJSON() },
  );
  return { via: 'template', templateName: template.name, message };
}

module.exports = {
  isAutoSendEnabled,
  captionFor,
  sendUploadedDocument,
  sendQuotation,
  sendReceiptForPayment,
  sendItinerary,
  sendBookingConfirmation,
};
