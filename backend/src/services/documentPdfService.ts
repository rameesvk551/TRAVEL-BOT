// FILE: /backend/src/services/documentPdfService.ts
//
// Renders quotation and receipt PDFs from the themed builder templates. Shares
// one Puppeteer html->PDF path. Invoices keep their existing dedicated service
// (invoicePdfService) which is already wired into accounting.

const Handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const {
  Quotation, QuotationTemplate, ReceiptTemplate, ItineraryTemplate, Itinerary,
  Payment, Booking, Customer, Agency, Package, Property, Cruise, Visa, Service,
} = require('../models');
const documentTemplates = require('./documentTemplates');
const brandingService = require('./brandingService');

documentTemplates.registerHelpers(Handlebars);

const CURRENCY = '₹';

function toPlain(value) {
  if (!value) return null;
  if (typeof value.toJSON === 'function') return value.toJSON();
  return value;
}

function num(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function paiseToMajor(value) {
  return Math.round(num(value)) / 100;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function safeFileName(raw) {
  return String(raw || 'document').replace(/[^a-z0-9_.-]/gi, '-');
}

/** Formats a date as DD-MM-YYYY (matches travel-itinerary convention). */
function formatDateDMY(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${dd}-${mm}-${date.getFullYear()}`;
}

/** Nights between two dates (>=0), or 0 if unknown. */
function nightsBetween(start, end) {
  if (!start || !end) return 0;
  const a = new Date(start);
  const b = new Date(end);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.max(0, Math.round((b - a) / (1000 * 60 * 60 * 24)));
}

function itemName(booking) {
  if (!booking) return 'Travel booking';
  if (booking.itemType === 'PROPERTY') return booking.property?.name || 'Property booking';
  if (booking.itemType === 'CRUISE') return booking.cruise?.name || 'Cruise booking';
  if (booking.itemType === 'VISA') return booking.visa ? `${booking.visa.country} Visa` : 'Visa booking';
  if (booking.itemType === 'SERVICE') return booking.service?.name || 'Service booking';
  if (booking.itemType === 'CUSTOM') return booking.customItemName || 'Custom booking';
  return booking.package?.name || 'Package booking';
}

/** Loads the default (or first) template row for a doc type, or null. */
async function loadTemplate(Model, agencyId, templateId) {
  if (templateId) {
    const byId = await Model.findOne({ where: { id: templateId, agencyId } });
    if (byId) return byId;
  }
  return (await Model.findOne({ where: { agencyId, isDefault: true } }))
    || (await Model.findOne({ where: { agencyId }, order: [['createdAt', 'DESC']] }));
}

/** Compiles a builder template (htmlContent + config) against document data. */
function renderHtml(docType, template, data) {
  const config = (template && template.config) || documentTemplates.defaultConfig(docType);
  const html = (template && template.htmlContent && template.htmlContent.trim())
    ? template.htmlContent
    : documentTemplates.templateHtml(docType, config.layout || 'modern');
  const flags = documentTemplates.flagsFromConfig(docType, config);
  const compiled = Handlebars.compile(html);
  return compiled({ config, ...flags, ...data });
}

async function htmlToPdf(html) {
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });
  try {
    const page = await browser.newPage();
    // Templates are pure HTML/CSS; disabling JS prevents any injected <script>
    // in a template from executing during server-side rendering.
    await page.setJavaScriptEnabled(false);
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdfBytes = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
    });
    return Buffer.from(pdfBytes);
  } finally {
    await browser.close();
  }
}

// ----- Quotation -----

async function buildQuotationData(quotationId, agencyId) {
  const record = await Quotation.findOne({
    where: { id: quotationId, ...(agencyId ? { agencyId } : {}) },
    include: [
      { model: Agency, as: 'agency' },
      { model: Customer, as: 'customer' },
      { model: QuotationTemplate, as: 'template' },
    ],
  });
  if (!record) {
    throw Object.assign(new Error('Quotation not found'), { statusCode: 404, code: 'QUOTATION_NOT_FOUND' });
  }
  const quotation = toPlain(record);
  const agency = quotation.agency || {};
  const customer = quotation.customer || {};
  const items = (quotation.items || []).map((it) => ({
    name: it.name,
    description: it.description,
    quantity: num(it.quantity) || 1,
    price: num(it.price),
    amount: num(it.amount != null ? it.amount : num(it.price) * (num(it.quantity) || 1)),
  }));
  const subTotal = num(quotation.subTotal) || items.reduce((s, it) => s + it.amount, 0);
  const total = num(quotation.totalAmount) || subTotal;
  const partner = await brandingService.brandingForAgency(agency);

  const data = {
    partner,
    agency,
    customer: {
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
      gstin: customer.gstin,
    },
    doc: {
      type: 'quotation',
      title: 'QUOTATION',
      number: quotation.quotationNumber,
      date: formatDate(quotation.date),
    },
    items,
    totals: {
      currency: CURRENCY,
      subTotal,
      total,
      amountInWords: quotation.amountInWords,
      showPayments: false,
    },
  };
  return { record, quotation, agency, customer, data, templateRow: quotation.template ? record.template : null };
}

async function generateQuotationPdf(quotationId, agencyId) {
  const { quotation, agency, customer, data } = await buildQuotationData(quotationId, agencyId);
  const template = await loadTemplate(QuotationTemplate, agency.id, quotation.templateId);
  const html = renderHtml('quotation', template, data);
  const buffer = await htmlToPdf(html);
  return {
    buffer,
    filename: safeFileName(`${quotation.quotationNumber || 'quotation'}.pdf`),
    html,
    ref: quotation.quotationNumber || String(quotation.id).slice(0, 8),
    recipient: { customerId: quotation.customerId, phone: customer.phone, name: customer.name },
  };
}

// ----- Receipt -----

async function buildReceiptData(paymentId, agencyId) {
  const record = await Payment.findOne({
    where: { id: paymentId, ...(agencyId ? { agencyId } : {}) },
    include: [
      { model: Agency, as: 'agency' },
      {
        model: Booking,
        as: 'booking',
        include: [
          { model: Customer, as: 'customer' },
          { model: Package, as: 'package' },
          { model: Property, as: 'property' },
          { model: Cruise, as: 'cruise' },
          { model: Visa, as: 'visa' },
          { model: Service, as: 'service' },
        ],
      },
    ],
  });
  if (!record) {
    throw Object.assign(new Error('Payment not found'), { statusCode: 404, code: 'PAYMENT_NOT_FOUND' });
  }
  const payment = toPlain(record);
  const agency = payment.agency || {};
  const booking = payment.booking || {};
  const customer = booking.customer || {};
  const amount = paiseToMajor(payment.amount);
  const partner = await brandingService.brandingForAgency(agency);

  const data = {
    partner,
    agency,
    customer: {
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
    },
    doc: {
      type: 'receipt',
      title: 'RECEIPT',
      number: `RCPT-${String(payment.id || '').slice(0, 8).toUpperCase()}`,
      date: formatDate(payment.paidAt || payment.updatedAt || new Date()),
    },
    payment: {
      method: payment.paymentMethod?.name || (payment.razorpayPaymentId ? 'Online (Razorpay)' : payment.type || 'Payment'),
      reference: payment.razorpayPaymentId || payment.razorpayPaymentLinkId || '',
      paidAt: formatDate(payment.paidAt),
    },
    items: [{
      name: `Payment for ${itemName(booking)}`,
      description: booking.bookingRef ? `Booking ${booking.bookingRef}` : '',
      quantity: 1,
      price: amount,
      amount,
    }],
    totals: {
      currency: CURRENCY,
      subTotal: amount,
      total: amount,
      paid: amount,
      balance: 0,
      showPayments: false,
    },
  };
  return { record, payment, agency, booking, customer, data };
}

async function generateReceiptPdf(paymentId, agencyId) {
  const { payment, agency, booking, customer, data } = await buildReceiptData(paymentId, agencyId);
  const template = await loadTemplate(ReceiptTemplate, agency.id, null);
  const html = renderHtml('receipt', template, data);
  const buffer = await htmlToPdf(html);
  return {
    buffer,
    filename: safeFileName(`receipt-${String(payment.id).slice(0, 8)}.pdf`),
    html,
    ref: String(payment.id).slice(0, 8),
    recipient: { customerId: booking.customerId, phone: customer.phone, name: customer.name },
  };
}

// ----- Itinerary -----

async function buildItineraryData(itineraryId, agencyId) {
  const record = await Itinerary.findOne({
    where: { id: itineraryId, ...(agencyId ? { agencyId } : {}) },
    include: [
      { model: Agency, as: 'agency' },
      { model: Customer, as: 'customer' },
      { model: ItineraryTemplate, as: 'template' },
    ],
  });
  if (!record) {
    throw Object.assign(new Error('Itinerary not found'), { statusCode: 404, code: 'ITINERARY_NOT_FOUND' });
  }
  const it = toPlain(record);
  const agencyRaw = it.agency || {};
  const customer = it.customer || {};

  const days = Array.isArray(it.days) ? it.days : [];
  const plan = days.map((d) => ({
    title: d.title || '',
    description: d.description || '',
    date: d.date ? formatDateDMY(d.date) : '',
  }));

  const hotels = (Array.isArray(it.hotels) ? it.hotels : []).map((h) => ({
    name: h.name || '',
    category: h.category || '',
    city: h.city || '',
    nights: h.nights || '',
    roomType: h.roomType || '',
    mealPlan: h.mealPlan || '',
    imageUrl: h.imageUrl || '',
  }));

  const vehicleRaw = it.vehicle || {};
  const vehicle = {
    type: vehicleRaw.type || '',
    features: (Array.isArray(vehicleRaw.features) ? vehicleRaw.features : []).filter(Boolean),
  };

  const priceRooms = (Array.isArray(it.priceRooms) ? it.priceRooms : []).map((r) => {
    const rate = num(r.rate);
    const pax = num(r.pax);
    return {
      label: r.label || '',
      rate,
      pax,
      amount: num(r.amount != null && r.amount !== '' ? r.amount : rate * (pax || 1)),
    };
  });

  const pricingRaw = it.pricing || {};
  const packageTotal = num(pricingRaw.packageTotal) || priceRooms.reduce((s, r) => s + r.amount, 0);
  const gstPercent = num(pricingRaw.gstPercent);
  const gstAmount = pricingRaw.gstAmount != null && pricingRaw.gstAmount !== ''
    ? num(pricingRaw.gstAmount)
    : Math.round((packageTotal * gstPercent) / 100 * 100) / 100;
  const grossTotal = num(pricingRaw.grossTotal) || (packageTotal + gstAmount);

  const nights = nightsBetween(it.travelStartDate, it.travelEndDate)
    || hotels.reduce((s, h) => s + (num(h.nights) || 0), 0)
    || Math.max(0, plan.length - 1);

  const website = agencyRaw.customDomain || agencyRaw.subdomain || '';
  const agency = { ...agencyRaw, website };

  const partner = await brandingService.brandingForAgency(agencyRaw);

  const data = {
    partner,
    agency,
    customer: {
      name: customer.name,
      phone: customer.phone,
      email: customer.email,
      address: customer.address,
    },
    doc: {
      type: 'itinerary',
      title: 'TRAVEL ITINERARY',
      number: it.productCode || String(it.id).slice(0, 8).toUpperCase(),
      date: formatDate(it.createdAt || new Date()),
    },
    trip: {
      productCode: it.productCode || '',
      summary: it.summary || it.destination || '',
      packageName: it.name || '',
      subtitle: it.summary && it.destination ? it.destination : '',
      nights,
      daysCount: plan.length || (nights ? nights + 1 : 0),
      checkIn: formatDateDMY(it.travelStartDate),
      checkOut: formatDateDMY(it.travelEndDate),
      adults: num(it.adults),
      children: num(it.children),
      destination: it.destination || '',
    },
    itinerary: {
      plan,
      hotels,
      vehicle,
      priceRooms,
      pricing: { currency: pricingRaw.currency || CURRENCY, packageTotal, gstPercent, gstAmount, grossTotal },
      inclusions: (Array.isArray(it.inclusions) ? it.inclusions : []).filter(Boolean),
      exclusions: (Array.isArray(it.exclusions) ? it.exclusions : []).filter(Boolean),
    },
  };

  return { record, itinerary: it, agency: agencyRaw, customer, data };
}

async function generateItineraryPdf(itineraryId, agencyId) {
  const { itinerary, agency, customer, data } = await buildItineraryData(itineraryId, agencyId);
  const template = await loadTemplate(ItineraryTemplate, agency.id, itinerary.templateId);
  const html = renderHtml('itinerary', template, data);
  const buffer = await htmlToPdf(html);
  return {
    buffer,
    filename: safeFileName(`${itinerary.name || 'itinerary'}.pdf`),
    html,
    ref: itinerary.productCode || String(itinerary.id).slice(0, 8),
    recipient: { customerId: itinerary.customerId, phone: customer.phone, name: customer.name },
  };
}

module.exports = {
  generateQuotationPdf,
  generateReceiptPdf,
  generateItineraryPdf,
  buildReceiptData,
  buildQuotationData,
  buildItineraryData,
};
