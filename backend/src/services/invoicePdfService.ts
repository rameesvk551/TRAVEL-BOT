// FILE: /backend/src/services/invoicePdfService.ts

const Handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const { InvoiceTemplate, Agency, Booking, Customer, Package, Property, Cruise, Visa, Service, AccountInvoice } = require('../models');
const brandingService = require('./brandingService');
const paymentQrService = require('./paymentQrService');

function toPlain(value) {
  if (!value) return null;
  if (typeof value.toJSON === 'function') return value.toJSON();
  return value;
}

function toInt(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
}

function formatMoney(amount) {
  return (toInt(amount) / 100).toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
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

function invoiceFileName(invoice, booking) {
  const plainInvoice = toPlain(invoice) || {};
  const plainBooking = toPlain(booking) || {};
  const raw = `${plainInvoice.invoiceNumber || plainBooking.bookingRef || 'invoice'}.pdf`;
  return raw.replace(/[^a-z0-9_.-]/gi, '-');
}

function defaultInvoiceTemplate() {
  return `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111827;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 13px;
      line-height: 1.45;
    }
    .page { padding: 34px 38px; }
    .top {
      align-items: flex-start;
      border-bottom: 2px solid #0f172a;
      display: flex;
      justify-content: space-between;
      padding-bottom: 22px;
    }
    .brand { max-width: 55%; }
    .logo { max-height: 64px; max-width: 190px; object-fit: contain; }
    .agency-name { font-size: 22px; font-weight: 800; margin: 0 0 8px; }
    .muted { color: #64748b; }
    .invoice-title { font-size: 30px; font-weight: 800; letter-spacing: 1px; margin: 0; text-align: right; }
    .invoice-meta { margin-top: 10px; text-align: right; }
    .grid { display: grid; gap: 18px; grid-template-columns: 1fr 1fr; margin-top: 28px; }
    .box { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
    .label { color: #64748b; font-size: 11px; font-weight: 800; letter-spacing: .08em; margin: 0 0 8px; text-transform: uppercase; }
    .strong { font-weight: 800; }
    table { border-collapse: collapse; margin-top: 28px; width: 100%; }
    th {
      background: #f8fafc;
      border-bottom: 1px solid #cbd5e1;
      color: #475569;
      font-size: 11px;
      letter-spacing: .08em;
      padding: 12px;
      text-align: left;
      text-transform: uppercase;
    }
    td { border-bottom: 1px solid #e5e7eb; padding: 13px 12px; vertical-align: top; }
    .right { text-align: right; }
    .totals { display: flex; justify-content: flex-end; margin-top: 18px; }
    .totals table { margin-top: 0; width: 330px; }
    .totals td { border: 0; padding: 7px 0 7px 16px; }
    .grand td { border-top: 2px solid #0f172a; font-size: 16px; font-weight: 800; padding-top: 12px; }
    .paid { color: #047857; }
    .due { color: #b91c1c; }
    .footer {
      align-items: flex-end;
      display: flex;
      justify-content: space-between;
      margin-top: 54px;
      page-break-inside: avoid;
    }
    .signature { min-width: 230px; text-align: center; }
    .signature img { max-height: 72px; max-width: 180px; object-fit: contain; }
    .signature-line { border-top: 1px solid #111827; margin-top: 14px; padding-top: 8px; }
    .tax-note { color: #64748b; font-size: 11px; margin-top: 10px; }
    .paybox {
      align-items: center;
      border: 1px solid #e5e7eb;
      border-radius: 8px;
      display: flex;
      gap: 18px;
      margin-top: 26px;
      padding: 16px;
      page-break-inside: avoid;
    }
    .payqr { height: 116px; width: 116px; }
    .payinfo .label { margin-bottom: 6px; }
    .payinfo .amount { color: #b91c1c; font-size: 18px; font-weight: 800; }
  </style>
</head>
<body>
  <main class="page">
    <section class="top">
      <div class="brand">
        {{#if agency.companyLogoUrl}}
          <img class="logo" src="{{agency.companyLogoUrl}}" alt="{{agency.name}}" />
        {{else}}
          <h1 class="agency-name">{{agency.name}}</h1>
        {{/if}}
        <div class="muted">{{agency.email}}</div>
        <div class="muted">{{agency.phone}}</div>
        {{#if invoice.supplierGstin}}<div class="muted">GSTIN: {{invoice.supplierGstin}}</div>{{/if}}
      </div>
      <div>
        <h2 class="invoice-title">INVOICE</h2>
        <div class="invoice-meta">
          <div><span class="muted">Invoice No:</span> <span class="strong">{{invoice.invoiceNumber}}</span></div>
          <div><span class="muted">Invoice Date:</span> {{formatDate invoice.invoiceDate}}</div>
          {{#if invoice.dueDate}}<div><span class="muted">Due Date:</span> {{formatDate invoice.dueDate}}</div>{{/if}}
        </div>
      </div>
    </section>

    <section class="grid">
      <div class="box">
        <p class="label">Bill To</p>
        <div class="strong">{{customer.name}}</div>
        <div class="muted">{{customer.email}}</div>
        <div class="muted">{{customer.phone}}</div>
        {{#if invoice.customerGstin}}<div class="muted">GSTIN: {{invoice.customerGstin}}</div>{{/if}}
      </div>
      <div class="box">
        <p class="label">Booking</p>
        <div><span class="muted">Reference:</span> <span class="strong">{{booking.bookingRef}}</span></div>
        <div><span class="muted">Service:</span> {{booking.itemName}}</div>
        {{#if booking.travelDate}}<div><span class="muted">Travel:</span> {{formatDate booking.travelDate}}</div>{{/if}}
        {{#if booking.returnDate}}<div><span class="muted">Return:</span> {{formatDate booking.returnDate}}</div>{{/if}}
      </div>
    </section>

    <table>
      <thead>
        <tr>
          <th>Description</th>
          <th class="right">Travellers</th>
          <th class="right">Rate</th>
          <th class="right">Amount</th>
        </tr>
      </thead>
      <tbody>
        {{#each lineItems}}
          <tr>
            <td>
              <div class="strong">{{description}}</div>
              {{#if detail}}<div class="muted">{{detail}}</div>{{/if}}
            </td>
            <td class="right">{{quantity}}</td>
            <td class="right">INR {{formatAmount unitAmount}}</td>
            <td class="right">INR {{formatAmount totalAmount}}</td>
          </tr>
        {{/each}}
      </tbody>
    </table>

    <section class="totals">
      <table>
        <tr><td class="muted">Taxable Amount</td><td class="right">INR {{formatAmount invoice.taxableAmount}}</td></tr>
        {{#if invoice.cgstAmount}}<tr><td class="muted">CGST</td><td class="right">INR {{formatAmount invoice.cgstAmount}}</td></tr>{{/if}}
        {{#if invoice.sgstAmount}}<tr><td class="muted">SGST</td><td class="right">INR {{formatAmount invoice.sgstAmount}}</td></tr>{{/if}}
        {{#if invoice.igstAmount}}<tr><td class="muted">IGST</td><td class="right">INR {{formatAmount invoice.igstAmount}}</td></tr>{{/if}}
        {{#unless invoice.gstAmount}}<tr><td class="muted">GST</td><td class="right">INR 0.00</td></tr>{{/unless}}
        <tr class="grand"><td>Total</td><td class="right">INR {{formatAmount invoice.totalAmount}}</td></tr>
        <tr><td class="paid">Paid</td><td class="right paid">INR {{formatAmount invoice.paidAmount}}</td></tr>
        <tr><td class="due">Balance Due</td><td class="right due">INR {{formatAmount balanceDue}}</td></tr>
      </table>
    </section>

    {{#if invoice.taxType}}<p class="tax-note">Tax type: {{invoice.taxType}}{{#if invoice.gstRateBps}} at {{formatPercentBps invoice.gstRateBps}}{{/if}}</p>{{/if}}

    {{#if paymentQr}}
    <section class="paybox">
      <img class="payqr" src="{{paymentQr.dataUrl}}" alt="Scan to pay balance" />
      <div class="payinfo">
        <p class="label">Scan to pay balance</p>
        <div class="amount">INR {{paymentQr.amount}}</div>
        <div class="muted">Scan with any UPI app — Google Pay, PhonePe, Paytm, BHIM. The amount is filled in automatically.</div>
        {{#if paymentQr.upiId}}<div class="muted">UPI: {{paymentQr.upiId}}</div>{{/if}}
      </div>
    </section>
    {{/if}}

    <section class="footer">
      <div class="muted">
        {{#if partner.brandName}}Powered by {{partner.brandName}}{{/if}}
      </div>
      <div class="signature">
        {{#if agency.authorizedSignatureUrl}}<img src="{{agency.authorizedSignatureUrl}}" alt="Authorized signature" />{{/if}}
        <div class="signature-line">Authorized Signature</div>
      </div>
    </section>
  </main>
</body>
</html>`;
}

Handlebars.registerHelper('formatAmount', formatMoney);
Handlebars.registerHelper('formatPaise', formatMoney);
Handlebars.registerHelper('formatDate', formatDate);
Handlebars.registerHelper('formatPercentBps', (bps) => `${(toInt(bps) / 100).toLocaleString('en-IN', { maximumFractionDigits: 2 })}%`);

async function getTemplate(agencyId) {
  const template = await InvoiceTemplate.findOne({
    where: { agencyId, isDefault: true },
  }) || await InvoiceTemplate.findOne({
    where: { agencyId },
    order: [['createdAt', 'DESC']],
  });

  return template?.htmlContent || defaultInvoiceTemplate();
}

async function generateInvoicePdf(bookingId, invoiceData = null, agencyId = null) {
  const bookingRecord = await Booking.findOne({
    where: { id: bookingId, ...(agencyId ? { agencyId } : {}) },
    include: [
      { model: Agency, as: 'agency' },
      { model: Customer, as: 'customer' },
      { model: Package, as: 'package' },
      { model: Property, as: 'property' },
      { model: Cruise, as: 'cruise' },
      { model: Visa, as: 'visa' },
      { model: Service, as: 'service' },
      { model: AccountInvoice, as: 'accountInvoice' },
    ],
  });

  if (!bookingRecord) {
    throw Object.assign(new Error('Booking not found'), { statusCode: 404, code: 'BOOKING_NOT_FOUND' });
  }

  const booking = toPlain(bookingRecord);
  const agency = booking.agency || {};
  const customer = booking.customer || {};
  const invoice = {
    ...toPlain(booking.accountInvoice),
    ...toPlain(invoiceData),
  };

  // COMMISSION_ONLY bookings: the accounting invoice holds only the agency's commission,
  // but the customer-facing PDF must still show the full package price and the balance the
  // customer pays directly at the property (a memo — never owed to the agency).
  const isCommissionOnly = booking.settlementType === 'COMMISSION_ONLY';
  const totalAmount = isCommissionOnly
    ? toInt(booking.totalAmount)
    : toInt(invoice.totalAmount || booking.totalAmount);
  const paidAmount = isCommissionOnly
    ? toInt(booking.advancePaid)
    : toInt(invoice.paidAmount ?? booking.advancePaid);
  // Property balance shown on the PDF, and the amount actually owed to the agency (drives
  // the "Balance Due" row + payment QR). They are mutually exclusive.
  const balanceAtProperty = isCommissionOnly ? Math.max(0, totalAmount - paidAmount) : 0;
  const agencyBalanceDue = isCommissionOnly ? 0 : Math.max(0, totalAmount - paidAmount);
  // The invoice's "Balance Due" row shows the remaining amount (total − paid) regardless of
  // settlement type. The payment QR still uses agencyBalanceDue, so commission-only invoices
  // (settled at the property) don't get a pay-to-agency QR.
  const displayBalanceDue = Math.max(0, totalAmount - paidAmount);
  const travellers = Math.max(1, toInt(booking.travellers) || 1);
  const baseAmount = toInt(booking.basePrice) || Math.round(totalAmount / travellers);
  
  const templateDoc = await InvoiceTemplate.findOne({
    where: { agencyId: agency.id, isDefault: true },
  }) || await InvoiceTemplate.findOne({
    where: { agencyId: agency.id },
    order: [['createdAt', 'DESC']],
  });

  const htmlContent = templateDoc?.htmlContent || defaultInvoiceTemplate();
  const config = templateDoc?.config || null;
  const documentTemplates = require('./documentTemplates');
  documentTemplates.registerHelpers(Handlebars);
  const flags = config ? documentTemplates.flagsFromConfig('invoice', config) : {};

  const compiledTemplate = Handlebars.compile(htmlContent);
  const partner = await brandingService.brandingForAgency(agency);

  // Balance-payment UPI QR: prefer a template-level VPA (builder config), else
  // the agency's own UPI ID. Encodes the outstanding balance so a UPI app
  // (Google Pay / PhonePe / Paytm) pre-fills the amount on scan.
  const balancePaise = agencyBalanceDue;
  const paymentVpa = (flags && flags.bank && flags.bank.upiId) || agency.upiId || '';
  const paymentQr = await paymentQrService.buildBalancePaymentQr({
    vpa: paymentVpa,
    payeeName: partner?.brandName || agency.name,
    balancePaise,
    note: `Invoice ${invoice.invoiceNumber || booking.bookingRef || ''}`.trim(),
  });

  const data = {
    agency,
    partner,
    customer,
    config: config || {},
    ...flags,
    doc: {
      type: 'invoice',
      title: config?.header?.title || 'INVOICE',
      number: invoice.invoiceNumber || `INV-${booking.bookingRef || booking.id}`,
      date: formatDate(invoice.invoiceDate || new Date().toISOString().slice(0, 10)),
      dueDate: invoice.dueDate ? formatDate(invoice.dueDate) : (booking.travelDate ? formatDate(booking.travelDate) : null),
    },
    payment: {
      method: booking.accountInvoice?.paymentMode || 'Online',
    },
    items: [{
      name: itemName(booking),
      description: booking.customItemDescription || booking.package?.duration || booking.service?.category || booking.visa?.visaType || '',
      quantity: travellers,
      price: baseAmount / 100,
      amount: totalAmount / 100,
    }],
    totals: {
      currency: '₹',
      subTotal: (isCommissionOnly ? totalAmount : toInt(invoice.taxableAmount || totalAmount)) / 100,
      cgst: (isCommissionOnly ? 0 : toInt(invoice.cgstAmount)) / 100,
      sgst: (isCommissionOnly ? 0 : toInt(invoice.sgstAmount)) / 100,
      igst: (isCommissionOnly ? 0 : toInt(invoice.igstAmount)) / 100,
      total: totalAmount / 100,
      paid: paidAmount / 100,
      balance: displayBalanceDue / 100,
      balanceAtProperty: balanceAtProperty / 100,
      showPayments: true,
      amountInWords: invoice.amountInWords || '',
    },
    // Legacy fields below
    booking: {
      ...booking,
      itemName: itemName(booking),
    },
    invoice: {
      invoiceNumber: invoice.invoiceNumber || `INV-${booking.bookingRef || booking.id}`,
      invoiceDate: invoice.invoiceDate || new Date().toISOString().slice(0, 10),
      dueDate: invoice.dueDate || booking.travelDate || null,
      status: invoice.status || 'ISSUED',
      taxableAmount: isCommissionOnly ? totalAmount : toInt(invoice.taxableAmount || totalAmount),
      gstAmount: isCommissionOnly ? 0 : toInt(invoice.gstAmount),
      cgstAmount: isCommissionOnly ? 0 : toInt(invoice.cgstAmount),
      sgstAmount: isCommissionOnly ? 0 : toInt(invoice.sgstAmount),
      igstAmount: isCommissionOnly ? 0 : toInt(invoice.igstAmount),
      totalAmount,
      paidAmount,
      gstRateBps: toInt(invoice.gstRateBps),
      taxType: invoice.taxType || 'NONE',
      taxBreakup: invoice.taxBreakup || {},
      supplierGstin: invoice.supplierGstin || agency.gstin || '',
      customerGstin: invoice.gstin || customer.gstin || '',
      placeOfSupplyStateCode: invoice.placeOfSupplyStateCode || customer.stateCode || '',
    },
    balanceDue: displayBalanceDue,
    // COMMISSION_ONLY memo: what the customer still pays at the property (0 otherwise).
    settlementType: booking.settlementType || 'FULL_COLLECTION',
    isCommissionOnly,
    balanceAtProperty,
    // Balance-payment QR (null when nothing due or no usable UPI id). The legacy
    // template reads `paymentQr.*`; builder templates read `qrCodeDataUrl`.
    paymentQr: paymentQr
      ? { dataUrl: paymentQr.dataUrl, upiIntent: paymentQr.upiIntent, amount: paymentQr.amountRupees, upiId: paymentVpa }
      : null,
    qrCodeDataUrl: paymentQr ? paymentQr.dataUrl : null,
    lineItems: [{
      description: itemName(booking),
      detail: booking.customItemDescription || booking.package?.duration || booking.service?.category || booking.visa?.visaType || '',
      quantity: travellers,
      unitAmount: baseAmount,
      totalAmount,
    }],
  };

  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setContent(compiledTemplate(data), { waitUntil: 'networkidle0' });
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

module.exports = {
  generateInvoicePdf,
  invoiceFileName,
};
