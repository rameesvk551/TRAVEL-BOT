// FILE: /backend/src/services/invoicePdfService.ts
const fs = require('fs');
const path = require('path');
const Handlebars = require('handlebars');
const puppeteer = require('puppeteer');
const { v4: uuidv4 } = require('uuid');
const { InvoiceTemplate, Agency, Booking, Customer } = require('../models');
const brandingService = require('./brandingService');

// Helper for currency formatting
Handlebars.registerHelper('formatAmount', function(amount) {
  if (amount === undefined || amount === null) return '0.00';
  return Number(amount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
});

async function generateInvoicePdf(bookingId, invoiceData) {
  const booking = await Booking.findByPk(bookingId, {
    include: [
      { model: Agency, as: 'agency' },
      { model: Customer, as: 'customer' }
    ]
  });

  if (!booking) {
    throw new Error('Booking not found');
  }

  const agency = booking.agency;
  
  // Find the default template or the latest one for the agency
  let template = await InvoiceTemplate.findOne({
    where: { agencyId: agency.id, isDefault: true }
  });

  if (!template) {
    template = await InvoiceTemplate.findOne({
      where: { agencyId: agency.id },
      order: [['createdAt', 'DESC']]
    });
  }

  if (!template || !template.htmlContent) {
    throw new Error('No invoice template found for agency');
  }

  // Compile template
  const compiledTemplate = Handlebars.compile(template.htmlContent);

  // White-label partner branding (available to templates as {{partner.*}},
  // e.g. a "Powered by {{partner.brandName}}" footer). Null/default for direct agencies.
  const partner = await brandingService.brandingForAgency(agency);

  // Prepare data
  const data = {
    agency: agency.toJSON(),
    partner,
    customer: booking.customer ? booking.customer.toJSON() : {},
    booking: booking.toJSON(),
    invoice: {
      invoiceNumber: invoiceData.invoiceNumber || `INV-${booking.id}`,
      invoiceDate: invoiceData.invoiceDate || new Date().toISOString().split('T')[0],
      totalAmount: invoiceData.totalAmount || booking.totalAmount,
      taxableAmount: invoiceData.taxableAmount || (booking.totalAmount * 0.82), // Dummy calc
      gstAmount: invoiceData.gstAmount || (booking.totalAmount * 0.18), // Dummy calc
      paidAmount: invoiceData.paidAmount || booking.paidAmount,
    },
    balanceDue: (invoiceData.totalAmount || booking.totalAmount) - (invoiceData.paidAmount || booking.paidAmount)
  };

  const html = compiledTemplate(data);

  // Generate PDF
  const browser = await puppeteer.launch({
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });
  
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: 'networkidle0' });
  const pdfBuffer = await page.pdf({ format: 'A4', printBackground: true });
  await browser.close();

  return pdfBuffer;
}

module.exports = {
  generateInvoicePdf,
};
