// FILE: /frontend/src/utils/documentBuilder.js
//
// Front-end mirror of backend/src/services/documentTemplates.ts so the live
// preview renders identically to the server-side PDF. Registers the same
// Handlebars helpers and flattens a saved `config` into the flags the templates
// read.

import Handlebars from 'handlebars';

export const FONT_OPTIONS = ['Manrope', 'Inter', 'Poppins', 'Roboto', 'Arial', 'Georgia'];

const FONT_STACKS = {
  Manrope: "'Manrope', 'Segoe UI', system-ui, sans-serif",
  Inter: "'Inter', 'Segoe UI', system-ui, sans-serif",
  Poppins: "'Poppins', 'Segoe UI', system-ui, sans-serif",
  Roboto: "'Roboto', 'Segoe UI', system-ui, sans-serif",
  Arial: 'Arial, Helvetica, sans-serif',
  Georgia: "Georgia, 'Times New Roman', serif",
};

let helpersRegistered = false;

export function registerDocumentHelpers() {
  if (helpersRegistered) return;
  Handlebars.registerHelper('money', (v) => {
    const n = Number(v);
    return (Number.isFinite(n) ? n : 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  });
  Handlebars.registerHelper('inc', (v) => Number(v || 0) + 1);
  Handlebars.registerHelper('eq', (a, b) => a === b);
  Handlebars.registerHelper('fontStack', (font) => FONT_STACKS[font] || FONT_STACKS.Manrope);
  Handlebars.registerHelper('brandColor', (c) => (typeof c === 'string' && c.trim()) ? c : '#111827');
  Handlebars.registerHelper('bgOverlay', (v) => {
    const n = Math.max(0, Math.min(100, Number(v)));
    return ((100 - (Number.isFinite(n) ? n : 12)) / 100).toFixed(2);
  });
  helpersRegistered = true;
}

/** Flattens config into the top-level flags the Handlebars templates expect. */
export function flagsFromConfig(config, defaultConfig) {
  const def = defaultConfig || {};
  const c = config || {};
  const fields = { ...(def.fields || {}), ...(c.fields || {}) };
  const header = { ...(def.header || {}), ...(c.header || {}) };
  const content = { ...(def.content || {}), ...(c.content || {}) };
  const showQrCode = fields.showQrCode !== undefined
    ? fields.showQrCode
    : !!(fields.showBankDetails && c.bank && c.bank.upiId);
  return {
    brand: { ...(def.brand || {}), ...(c.brand || {}) },
    header,
    fields,
    bank: { ...(def.bank || {}), ...(c.bank || {}) },
    showLogo: header.showLogo,
    showBankDetails: fields.showBankDetails,
    showQrCode,
    showSignatory: fields.showSignatory,
    showTerms: fields.showTerms,
    showNotes: fields.showNotes,
    showPaidStamp: fields.showPaidStamp,
    showGst: fields.showGst,
    terms: content.termsText,
    notes: content.notesText,
    footer: content.footerText,
  };
}

/** Compiles a template's htmlContent against config + sample data for preview. */
export function renderPreviewHtml(htmlContent, config, defaultConfig, sampleData) {
  registerDocumentHelpers();
  try {
    const flags = flagsFromConfig(config, defaultConfig);
    const compiled = Handlebars.compile(htmlContent || '');
    return compiled({ config: config || {}, ...flags, ...sampleData });
  } catch (err) {
    return `<div style="color:#b91c1c; padding:24px; font-family:sans-serif;">Preview error: ${err.message}</div>`;
  }
}

/** Sample data per document type for the live preview. */
export function sampleDataFor(docType) {
  const agency = {
    name: 'Wayon Holidays',
    email: 'hello@wayon.travel',
    phone: '+91 98765 43210',
    gstin: '32ABCDE1234F1Z5',
    companyLogoUrl: '',
    authorizedSignatureUrl: '',
  };
  const customer = {
    name: 'Priya Sharma',
    phone: '+91 90000 12345',
    email: 'priya@example.com',
    address: 'MG Road, Kochi, Kerala',
    gstin: '',
  };
  const items = [
    { name: 'Kashmir Honeymoon Package (5N/6D)', description: 'Deluxe houseboat + Gulmarg', quantity: 2, price: 24500, amount: 49000 },
    { name: 'Airport Transfers', description: 'Private cab, both ways', quantity: 1, price: 4500, amount: 4500 },
  ];
  const titleByType = { quotation: 'QUOTATION', invoice: 'INVOICE', receipt: 'RECEIPT' };
  if (docType === 'itinerary') {
    return {
      agency: { ...agency, website: 'www.wayon.travel' },
      customer,
      doc: { type: 'itinerary', title: 'TRAVEL ITINERARY', number: 'TS0170-RGPJS', date: '23 Jun 2026' },
      trip: {
        productCode: 'TS0170-RGPJS',
        summary: 'Shimla 2N · Manali 2N',
        packageName: 'Himachal Holiday Package',
        subtitle: 'Himachal 4N: Shimla 2N | Manali 2N',
        nights: 4,
        daysCount: 5,
        checkIn: '19-06-2026',
        checkOut: '23-06-2026',
        adults: 2,
        children: 0,
        destination: 'Himachal Pradesh',
      },
      itinerary: {
        plan: [
          { title: 'Arrival at Chandigarh & drive to Shimla', description: 'On arrival at Chandigarh proceed to Shimla, the former summer capital of British India. Check in to the hotel and relax. Overnight stay in Shimla.', date: '' },
          { title: 'Shimla Sightseeing', description: 'Visit Kufri, then take a walking tour of Shimla — Jakhoo Hills, the Vice Regal Lodge and Mall Road. Overnight stay in Shimla.', date: '' },
          { title: 'Shimla to Manali', description: 'After breakfast drive to Manali, en route visiting Kullu. Evening check-in and free time at Mall Road. Overnight stay in Manali.', date: '' },
          { title: 'Manali (Local Sightseeing + Solang Valley)', description: 'Half-day sightseeing of Hadimba Temple, Vashist Temple, Club House and Solang Valley. Evening at leisure. Overnight stay in Manali.', date: '' },
          { title: 'Departure from Chandigarh', description: 'As your trip comes to an end, transfer to Chandigarh for your onward journey. We look forward to welcoming you back!', date: '' },
        ],
        hotels: [
          { name: 'Cross Winds West Shimla', category: '3 Star', city: 'Shimla', nights: 2, roomType: 'Super Deluxe Room With Balcony', mealPlan: 'Breakfast and Dinner', imageUrl: '' },
          { name: 'Hotel Pine Crest Manali', category: '3 Star', city: 'Manali', nights: 2, roomType: 'Super Deluxe Room With Balcony', mealPlan: 'Breakfast and Dinner', imageUrl: '' },
        ],
        vehicle: {
          type: 'Sedan (4 Seater)',
          features: ['Commercial Vehicle', 'Vehicle Insurance', 'Driver Allowance Included', 'Toll & Parking Fee Included', 'Night Halt Charges Included', 'Inter-State Permit Included', 'AC Vehicle', '24x7 On Call Assistance', 'Experienced Driver'],
        },
        priceRooms: [
          { label: 'Room 1: Double Sharing', rate: 18500, pax: 2, amount: 37000 },
        ],
        pricing: { currency: '₹', packageTotal: 37000, gstPercent: 5, gstAmount: 1850, grossTotal: 38850 },
        inclusions: ['04 Nights stay in 3 Star premium hotels', 'Daily breakfast and dinner', 'Return transfers from Chandigarh on private basis', 'Local sightseeing in Shimla & Kufri', 'Transfer from Shimla to Manali via Kullu Valley', 'Manali local sightseeing & Solang Valley excursion', 'All applicable taxes'],
        exclusions: ['Flights, trains and ferries', 'Monument entrance fees & camera fees', 'Personal expenses — laundry, shopping, tips', 'Adventure activities — safari, rides, paragliding', 'Anything not listed in inclusions'],
      },
    };
  }
  if (docType === 'receipt') {
    return {
      agency, customer,
      doc: { type: 'receipt', title: 'RECEIPT', number: 'RCPT-8F2A1C', date: '23 Jun 2026' },
      payment: { method: 'Online (Razorpay)', reference: 'pay_Qk29Zl', paidAt: '23 Jun 2026' },
      items: [{ name: 'Payment for Kashmir Honeymoon Package', description: 'Booking BK-2041', quantity: 1, price: 25000, amount: 25000 }],
      totals: { currency: '₹', subTotal: 25000, total: 25000, paid: 25000, balance: 0, showPayments: false },
    };
  }
  return {
    agency, customer,
    doc: { type: docType, title: titleByType[docType] || 'DOCUMENT', number: docType === 'invoice' ? 'INV-2026-0042' : 'EST-2026-0042', date: '23 Jun 2026', dueDate: docType === 'invoice' ? '30 Jun 2026' : '' },
    items,
    totals: {
      currency: '₹',
      subTotal: 53500,
      cgst: docType === 'invoice' ? 1338 : 0,
      sgst: docType === 'invoice' ? 1338 : 0,
      total: docType === 'invoice' ? 56176 : 53500,
      paid: docType === 'invoice' ? 20000 : 0,
      balance: docType === 'invoice' ? 36176 : 0,
      amountInWords: 'Fifty Three Thousand Five Hundred',
      showPayments: docType === 'invoice',
    },
  };
}
