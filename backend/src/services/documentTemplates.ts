// FILE: /backend/src/services/documentTemplates.ts
//
// Single source of truth for the document "themed customizer". Holds the layout
// presets (Modern / Classic / Minimal) and the default visual-builder config for
// each document type (quotation, invoice, receipt). The same Handlebars HTML is
// used for the live preview in the builder UI, for the stored template, and for
// server-side PDF rendering — so what the user designs is exactly what prints.
//
// All money values handed to these templates are already in MAJOR units (e.g.
// rupees), so the `money` helper only formats — it never divides.

const DOC_TYPES = ['quotation', 'invoice', 'receipt', 'itinerary'];

const DOC_META = {
  quotation: { title: 'QUOTATION', numberLabel: 'Quotation No', partyLabel: 'Quotation For', accent: '#4f46e5' },
  invoice: { title: 'INVOICE', numberLabel: 'Invoice No', partyLabel: 'Bill To', accent: '#0f766e' },
  receipt: { title: 'RECEIPT', numberLabel: 'Receipt No', partyLabel: 'Received From', accent: '#047857' },
  itinerary: { title: 'TRAVEL ITINERARY', numberLabel: 'Itinerary No', partyLabel: 'Prepared For', accent: '#ea7a25' },
};

const FONT_STACKS = {
  Manrope: "'Manrope', 'Segoe UI', system-ui, sans-serif",
  Inter: "'Inter', 'Segoe UI', system-ui, sans-serif",
  Poppins: "'Poppins', 'Segoe UI', system-ui, sans-serif",
  Roboto: "'Roboto', 'Segoe UI', system-ui, sans-serif",
  Arial: "Arial, Helvetica, sans-serif",
  Georgia: "Georgia, 'Times New Roman', serif",
};

/** Default visual-builder config for a document type. */
function defaultConfig(type) {
  const meta = DOC_META[type] || DOC_META.quotation;
  if (type === 'itinerary') {
    return {
      layout: 'modern',
      brand: {
        logoUrl: '',
        signatureUrl: '',
        primaryColor: meta.accent,
        accentColor: '#111827',
        textColor: '#1f2937',
        fontFamily: 'Manrope',
        backgroundUrl: '',
        backgroundOpacity: 12,
        coverUrl: '',
      },
      header: {
        title: meta.title,
        tagline: '',
        showLogo: true,
      },
      fields: {
        showDayPlan: true,
        showVehicle: true,
        showHotels: true,
        showPriceBreakup: true,
        showInclusions: true,
        showExclusions: true,
        showContactFooter: true,
        showTerms: false,
        showNotes: false,
      },
      content: {
        termsText: '1. Prices are subject to availability at the time of confirmation.\n2. Standard cancellation policies apply.',
        notesText: '',
        footerText: '',
      },
      bank: { name: '', account: '', ifsc: '', upiId: '' },
    };
  }
  return {
    layout: 'modern',
    brand: {
      logoUrl: '',
      signatureUrl: '',
      primaryColor: meta.accent,
      accentColor: '#111827',
      textColor: '#111827',
      fontFamily: 'Manrope',
    },
    header: {
      title: meta.title,
      tagline: '',
      showLogo: true,
    },
    fields: {
      showBankDetails: type !== 'receipt',
      showQrCode: type === 'invoice',
      showSignatory: true,
      showTerms: type !== 'receipt',
      showNotes: true,
      showPaidStamp: type === 'receipt',
      showGst: type === 'invoice',
    },
    content: {
      termsText: type === 'receipt'
        ? ''
        : '1. Inclusions strictly as specified above.\n2. Prices are subject to availability at the time of confirmation.\n3. Standard cancellation policies apply.',
      notesText: type === 'receipt' ? 'Thank you for your payment.' : 'Thank you for choosing us. We look forward to serving you.',
      footerText: '',
    },
    bank: {
      name: '',
      account: '',
      ifsc: '',
      upiId: '',
    },
  };
}

/**
 * Renders the shared HTML shell: fonts, CSS variables driven by config, and the
 * page chrome. `body` is the layout-specific markup.
 */
function shell(type, body) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  :root {
    --brand: {{brandColor brand.primaryColor}};
    --accent: {{brandColor brand.accentColor}};
    --text: {{brandColor brand.textColor}};
    --muted: #6b7280;
    --line: #e5e7eb;
    --soft: #f8fafc;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: var(--text);
    font-family: {{fontStack brand.fontFamily}};
    font-size: 13px;
    line-height: 1.5;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .page { padding: 40px 44px; max-width: 820px; margin: 0 auto; position: relative; }
  .muted { color: var(--muted); }
  .right { text-align: right; }
  .strong { font-weight: 700; }
  .logo { max-height: 60px; max-width: 200px; object-fit: contain; }
  .brand-name { font-size: 22px; font-weight: 800; margin: 0 0 6px; color: var(--text); }
  .doc-title { font-weight: 800; letter-spacing: 1px; margin: 0; }
  table.items { border-collapse: collapse; width: 100%; margin-top: 26px; font-size: 13px; }
  table.items th { padding: 11px 12px; text-align: left; font-size: 11px; letter-spacing: .06em; text-transform: uppercase; }
  table.items th.right { text-align: right; }
  table.items td { padding: 12px; border-bottom: 1px solid var(--line); vertical-align: top; }
  .totals { display: flex; justify-content: flex-end; margin-top: 18px; }
  .totals table { width: 320px; border-collapse: collapse; }
  .totals td { padding: 6px 0; }
  .totals .grand td { font-size: 16px; font-weight: 800; padding-top: 12px; }
  .pill { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; letter-spacing: .05em; text-transform: uppercase; }
  .section { margin-top: 30px; font-size: 12.5px; }
  .section h4 { margin: 0 0 8px; font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: var(--muted); }
  .preline { white-space: pre-wrap; color: #374151; }
  .footer-grid { display: flex; justify-content: space-between; align-items: flex-end; gap: 24px; margin-top: 38px; page-break-inside: avoid; }
  .sign { text-align: center; min-width: 200px; }
  .sign img { max-height: 64px; max-width: 170px; object-fit: contain; }
  .sign-line { border-top: 1px solid var(--text); margin-top: 12px; padding-top: 6px; font-weight: 600; }
  .qr { width: 92px; height: 92px; border: 1px solid var(--line); border-radius: 8px; display: flex; align-items: center; justify-content: center; color: var(--muted); font-size: 10px; text-align: center; }
  .stamp { position: absolute; top: 130px; right: 60px; border: 3px solid var(--brand); color: var(--brand); font-size: 30px; font-weight: 900; letter-spacing: 4px; padding: 8px 20px; border-radius: 10px; transform: rotate(-14deg); opacity: .85; }
  .doc-footer-note { margin-top: 30px; text-align: center; color: var(--muted); font-size: 11px; }
</style>
</head>
<body>
  <main class="page">
    {{#if showPaidStamp}}<div class="stamp">PAID</div>{{/if}}
    ${body}
    {{#if footer}}<div class="doc-footer-note">{{footer}}</div>{{/if}}
    {{#if partner.brandName}}<div class="doc-footer-note">Powered by {{partner.brandName}}</div>{{/if}}
  </main>
</body>
</html>`;
}

/** Shared parties / items / totals / footer fragments, theme-agnostic. */
function partiesBlock(type) {
  const meta = DOC_META[type];
  return `
    <section style="display:flex; justify-content:space-between; gap:24px; margin-top:30px;">
      <div style="flex:1;">
        <h4 style="margin:0 0 8px; font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted);">${meta.partyLabel}</h4>
        <div class="strong" style="font-size:15px;">{{customer.name}}</div>
        {{#if customer.phone}}<div class="muted">{{customer.phone}}</div>{{/if}}
        {{#if customer.email}}<div class="muted">{{customer.email}}</div>{{/if}}
        {{#if customer.address}}<div class="muted">{{customer.address}}</div>{{/if}}
        {{#if showGst}}{{#if customer.gstin}}<div class="muted">GSTIN: {{customer.gstin}}</div>{{/if}}{{/if}}
      </div>
      <div style="flex:1; text-align:right;">
        <div><span class="muted">${meta.numberLabel}:</span> <span class="strong">{{doc.number}}</span></div>
        <div><span class="muted">Date:</span> {{doc.date}}</div>
        {{#if doc.dueDate}}<div><span class="muted">Due Date:</span> {{doc.dueDate}}</div>{{/if}}
        {{#if payment.method}}<div><span class="muted">Mode:</span> {{payment.method}}</div>{{/if}}
        {{#if payment.reference}}<div><span class="muted">Ref:</span> {{payment.reference}}</div>{{/if}}
        {{#if showGst}}{{#if agency.gstin}}<div class="muted">Supplier GSTIN: {{agency.gstin}}</div>{{/if}}{{/if}}
      </div>
    </section>`;
}

function itemsTable(type, opts = {}) {
  const headBg = opts.solidHead ? 'background:var(--brand); color:#fff;' : 'background:var(--soft); color:var(--muted); border-bottom:2px solid var(--brand);';
  return `
    <table class="items">
      <thead>
        <tr style="${headBg}">
          <th style="width:36px;">#</th>
          <th>Description</th>
          <th class="right" style="width:70px;">Qty</th>
          <th class="right" style="width:110px;">Rate</th>
          <th class="right" style="width:120px;">Amount</th>
        </tr>
      </thead>
      <tbody>
        {{#each items}}
        <tr>
          <td class="muted">{{inc @index}}</td>
          <td><div class="strong">{{this.name}}</div>{{#if this.description}}<div class="muted" style="font-size:12px;">{{this.description}}</div>{{/if}}</td>
          <td class="right">{{this.quantity}}</td>
          <td class="right">{{../totals.currency}} {{money this.price}}</td>
          <td class="right">{{../totals.currency}} {{money this.amount}}</td>
        </tr>
        {{/each}}
      </tbody>
    </table>`;
}

function totalsBlock() {
  return `
    <div class="totals">
      <table>
        <tr><td class="muted">Sub Total</td><td class="right">{{totals.currency}} {{money totals.subTotal}}</td></tr>
        {{#if totals.discount}}<tr><td class="muted">Discount</td><td class="right">- {{totals.currency}} {{money totals.discount}}</td></tr>{{/if}}
        {{#if showGst}}
          {{#if totals.cgst}}<tr><td class="muted">CGST</td><td class="right">{{totals.currency}} {{money totals.cgst}}</td></tr>{{/if}}
          {{#if totals.sgst}}<tr><td class="muted">SGST</td><td class="right">{{totals.currency}} {{money totals.sgst}}</td></tr>{{/if}}
          {{#if totals.igst}}<tr><td class="muted">IGST</td><td class="right">{{totals.currency}} {{money totals.igst}}</td></tr>{{/if}}
        {{/if}}
        <tr class="grand" style="border-top:2px solid var(--brand);"><td>Total</td><td class="right" style="color:var(--brand);">{{totals.currency}} {{money totals.total}}</td></tr>
        {{#if totals.showPayments}}
          <tr><td class="muted" style="color:#047857;">Paid</td><td class="right" style="color:#047857;">{{totals.currency}} {{money totals.paid}}</td></tr>
          <tr><td class="strong" style="color:#b91c1c;">Balance Due</td><td class="right strong" style="color:#b91c1c;">{{totals.currency}} {{money totals.balance}}</td></tr>
        {{/if}}
      </table>
    </div>
    {{#if totals.amountInWords}}<div class="muted" style="margin-top:10px; font-size:12px;">Amount in words: <span class="strong" style="color:var(--text);">{{totals.amountInWords}} only</span></div>{{/if}}`;
}

function footerBlock() {
  return `
    {{#if showTerms}}{{#if terms}}<div class="section"><h4>Terms &amp; Conditions</h4><div class="preline">{{terms}}</div></div>{{/if}}{{/if}}
    {{#if showNotes}}{{#if notes}}<div class="section"><h4>Notes</h4><div class="preline">{{notes}}</div></div>{{/if}}{{/if}}
    <div class="footer-grid">
      <div>
        {{#if showBankDetails}}
        <div style="display:flex; gap:16px; align-items:flex-start;">
          {{#if showQrCode}}<div class="qr">{{#if qrCodeDataUrl}}<img src="{{qrCodeDataUrl}}" style="width:100%; height:100%; object-fit:contain;" alt="Scan to pay" />{{else}}{{#if bank.upiId}}UPI<br/>{{bank.upiId}}{{else}}QR{{/if}}{{/if}}</div>{{/if}}
          <div>
            <h4 style="margin:0 0 6px; font-size:11px; text-transform:uppercase; letter-spacing:.06em; color:var(--muted);">Payment Details</h4>
            {{#if bank.name}}<div>Bank: <span class="strong">{{bank.name}}</span></div>{{/if}}
            {{#if bank.account}}<div>A/C: {{bank.account}}</div>{{/if}}
            {{#if bank.ifsc}}<div>IFSC: {{bank.ifsc}}</div>{{/if}}
            {{#if bank.upiId}}<div>UPI: {{bank.upiId}}</div>{{/if}}
          </div>
        </div>
        {{/if}}
      </div>
      {{#if showSignatory}}
      <div class="sign">
        <div class="muted" style="margin-bottom:8px;">For {{#if brand.name}}{{brand.name}}{{else}}{{agency.name}}{{/if}}</div>
        {{#if brand.signatureUrl}}<img src="{{brand.signatureUrl}}" alt="Signature" />{{else}}{{#if agency.authorizedSignatureUrl}}<img src="{{agency.authorizedSignatureUrl}}" alt="Signature" />{{/if}}{{/if}}
        <div class="sign-line">Authorised Signatory</div>
      </div>
      {{/if}}
    </div>`;
}

function logoOrName() {
  return `{{#if showLogo}}{{#if brand.logoUrl}}<img class="logo" src="{{brand.logoUrl}}" alt="logo" />{{else}}{{#if agency.companyLogoUrl}}<img class="logo" src="{{agency.companyLogoUrl}}" alt="logo" />{{else}}<div class="brand-name">{{#if brand.name}}{{brand.name}}{{else}}{{agency.name}}{{/if}}</div>{{/if}}{{/if}}{{else}}<div class="brand-name">{{#if brand.name}}{{brand.name}}{{else}}{{agency.name}}{{/if}}</div>{{/if}}`;
}

/** ---- Layout: Modern (coloured header band) ---- */
function layoutModern(type) {
  const header = `
    <section style="background:var(--brand); color:#fff; border-radius:14px; padding:26px 28px; display:flex; justify-content:space-between; align-items:flex-start;">
      <div style="background:#fff; padding:10px 14px; border-radius:10px;">${logoOrName()}</div>
      <div style="text-align:right;">
        <h1 class="doc-title" style="font-size:30px;">{{header.title}}</h1>
        {{#if header.tagline}}<div style="opacity:.85; margin-top:4px;">{{header.tagline}}</div>{{/if}}
        <div style="margin-top:6px; opacity:.9;">{{agency.email}} · {{agency.phone}}</div>
      </div>
    </section>
    ${partiesBlock(type)}`;
  return shell(type, header + itemsTable(type, { solidHead: true }) + totalsBlock() + footerBlock());
}

/** ---- Layout: Classic (serif, centred, bordered) ---- */
function layoutClassic(type) {
  const header = `
    <section style="text-align:center; border-bottom:3px double var(--brand); padding-bottom:18px;">
      <div style="margin-bottom:8px;">${logoOrName()}</div>
      <div class="muted">{{agency.email}} · {{agency.phone}}{{#if agency.gstin}} · GSTIN {{agency.gstin}}{{/if}}</div>
      <h1 class="doc-title" style="font-size:26px; margin-top:14px; color:var(--brand);">{{header.title}}</h1>
      {{#if header.tagline}}<div class="muted">{{header.tagline}}</div>{{/if}}
    </section>
    ${partiesBlock(type)}`;
  return shell(type, header + itemsTable(type, { solidHead: false }) + totalsBlock() + footerBlock());
}

/** ---- Layout: Minimal (whitespace, thin rules, single accent) ---- */
function layoutMinimal(type) {
  const header = `
    <section style="display:flex; justify-content:space-between; align-items:flex-start; border-bottom:1px solid var(--line); padding-bottom:22px;">
      <div>
        <div style="margin-bottom:10px;">${logoOrName()}</div>
        <div class="muted">{{agency.email}}</div>
        <div class="muted">{{agency.phone}}</div>
      </div>
      <div style="text-align:right;">
        <h1 class="doc-title" style="font-size:24px; color:var(--brand);">{{header.title}}</h1>
        {{#if header.tagline}}<div class="muted" style="margin-top:4px;">{{header.tagline}}</div>{{/if}}
      </div>
    </section>
    ${partiesBlock(type)}`;
  return shell(type, header + itemsTable(type, { solidHead: false }) + totalsBlock() + footerBlock());
}

// =====================================================================
//  ITINERARY — multi-section travel document (day plan, vehicle, hotels,
//  price breakup, inclusions / exclusions). Full-bleed header/footer bands
//  + white section cards, themed by the same brand config as the others.
// =====================================================================

/** Shared CSS + HTML shell for itinerary layouts. `headerBand` is layout-specific. */
function itineraryShell(headerBand) {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<style>
  :root {
    --brand: {{brandColor brand.primaryColor}};
    --accent: {{brandColor brand.accentColor}};
    --text: {{brandColor brand.textColor}};
    --muted: #6b7280;
    --line: #e5e7eb;
    --soft: #f8fafc;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    color: var(--text);
    background: #fbf3ea;
    font-family: {{fontStack brand.fontFamily}};
    font-size: 13px;
    line-height: 1.55;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .it-band { background: var(--brand); color: #fff; }
  .it-topbar { display: flex; justify-content: space-between; align-items: center; padding: 14px 36px; }
  .it-topbar .it-logo { background: #fff; border-radius: 8px; padding: 6px 12px; display: inline-flex; align-items: center; }
  .it-topbar .it-logo img { max-height: 46px; max-width: 170px; object-fit: contain; }
  .it-topbar .it-brand-name { font-size: 18px; font-weight: 800; color: var(--brand); }
  .it-summary { font-size: 18px; font-weight: 700; }
  .it-wrap { padding: 22px 36px 30px; }
  .it-titlebar { display: flex; align-items: center; gap: 18px; padding: 4px 0 22px; }
  .it-nd { display: flex; gap: 6px; }
  .it-nd-box { background: var(--brand); color: #fff; border-radius: 8px; min-width: 52px; text-align: center; padding: 8px 6px; }
  .it-nd-num { font-size: 24px; font-weight: 800; line-height: 1; }
  .it-nd-lbl { font-size: 10px; text-transform: uppercase; letter-spacing: .05em; opacity: .95; }
  .it-title-main { flex: 1; }
  .it-title-main h1 { margin: 0; font-size: 21px; font-weight: 800; color: var(--text); }
  .it-title-main .it-sub { color: var(--muted); font-size: 12.5px; margin-top: 2px; }
  .it-pcode { color: var(--muted); font-size: 12px; white-space: nowrap; }
  .it-card { background: #fff; border-radius: 14px; box-shadow: 0 10px 30px -22px rgba(15,23,42,.5); padding: 20px 24px; margin-bottom: 18px; page-break-inside: avoid; }
  .it-card-head { display: flex; align-items: center; gap: 10px; border-bottom: 1px solid var(--line); padding-bottom: 12px; margin-bottom: 14px; }
  .it-ico { width: 30px; height: 30px; border-radius: 8px; background: #fdeede; background: color-mix(in srgb, var(--brand) 16%, #fff); color: var(--brand); display: inline-flex; align-items: center; justify-content: center; font-size: 15px; font-weight: 800; }
  .it-card-head h3 { margin: 0; font-size: 16px; font-weight: 700; color: var(--text); }
  .muted { color: var(--muted); }
  .it-day { display: flex; gap: 10px; padding: 8px 0; }
  .it-day + .it-day { border-top: 1px dashed var(--line); }
  .it-day-label { font-weight: 700; white-space: nowrap; min-width: 52px; }
  .it-day-title { font-weight: 700; }
  .it-day-desc { color: #4b5563; margin-top: 3px; }
  .it-veh-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px 18px; }
  .it-veh-item { font-size: 12.5px; }
  .it-tick { color: var(--brand); font-weight: 800; margin-right: 6px; }
  .it-cross { color: #dc2626; font-weight: 800; margin-right: 6px; }
  .it-hotel { display: grid; grid-template-columns: 64px 2.4fr 1fr 1fr 1fr; gap: 14px; align-items: center; padding: 12px 0; }
  .it-hotel + .it-hotel { border-top: 1px solid var(--line); }
  .it-hotel-thumb { width: 64px; height: 56px; border-radius: 8px; background: #e5e7eb; color: #9ca3af; display: flex; align-items: center; justify-content: center; font-weight: 800; overflow: hidden; }
  .it-hotel-thumb img { width: 100%; height: 100%; object-fit: cover; }
  .it-hotel-name { font-weight: 700; }
  .it-hotel-meta { font-size: 12.5px; color: #374151; }
  .it-price-grid { display: grid; grid-template-columns: 1fr 1.15fr; gap: 22px; }
  .it-fact { display: flex; justify-content: space-between; align-items: center; border: 1px solid var(--line); border-radius: 10px; padding: 10px 14px; margin-bottom: 10px; }
  .it-fact span { color: var(--muted); }
  .it-fact strong { color: var(--text); }
  .it-price-right { border: 1px solid var(--line); border-radius: 12px; padding: 16px 18px; }
  .it-veh-type { color: var(--brand); font-weight: 700; margin-bottom: 12px; }
  .it-breakup-title { font-weight: 700; margin-bottom: 8px; }
  .it-breakup-row { display: flex; justify-content: space-between; gap: 10px; padding: 6px 0; border-bottom: 1px solid var(--line); }
  .it-breakup-row span:first-child { flex: 1; color: #374151; }
  .it-breakup-row span:last-child { font-variant-numeric: tabular-nums; white-space: nowrap; }
  .it-breakup-row.strongrow span { font-weight: 700; }
  .it-breakup-row.grandrow { border-bottom: none; border-top: 2px solid var(--brand); margin-top: 4px; padding-top: 10px; }
  .it-breakup-row.grandrow span { font-weight: 800; font-size: 15px; color: var(--brand); }
  .it-list-item { padding: 5px 0; font-size: 12.5px; }
  .it-section-title { color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: .06em; margin: 0 0 6px; }
  .it-preline { white-space: pre-wrap; color: #374151; }
  .it-footer-band { display: flex; justify-content: center; gap: 8px; padding: 12px 36px; font-size: 12px; }
  .it-poweredby { text-align: center; color: var(--muted); font-size: 10.5px; padding: 8px 0 0; }
  .it-cover { height: 190px; background-size: cover; background-position: center; }
</style>
</head>
<body{{#if brand.backgroundUrl}} style="background-image: linear-gradient(rgba(251,243,234,{{bgOverlay brand.backgroundOpacity}}), rgba(251,243,234,{{bgOverlay brand.backgroundOpacity}})), url('{{brand.backgroundUrl}}'); background-size: cover; background-position: center; background-attachment: fixed;"{{/if}}>
  ${headerBand}
  {{#if brand.coverUrl}}<div class="it-cover" style="background-image: url('{{brand.coverUrl}}');"></div>{{/if}}
  <main class="it-wrap">
    <section class="it-titlebar">
      <div class="it-nd">
        <div class="it-nd-box"><div class="it-nd-num">{{trip.nights}}</div><div class="it-nd-lbl">Nights</div></div>
        <div class="it-nd-box"><div class="it-nd-num">{{trip.daysCount}}</div><div class="it-nd-lbl">Days</div></div>
      </div>
      <div class="it-title-main">
        <h1>{{#if trip.packageName}}{{trip.packageName}}{{else}}{{header.title}}{{/if}}</h1>
        {{#if trip.subtitle}}<div class="it-sub">{{trip.subtitle}}</div>{{/if}}
      </div>
      {{#if trip.productCode}}<div class="it-pcode">Product Code: <strong>{{trip.productCode}}</strong></div>{{/if}}
    </section>

    {{#if customer.name}}
    <section class="it-card">
      <div class="it-section-title">${'{{partyLabelText}}'}</div>
      <div class="it-hotel-name" style="font-size:15px;">{{customer.name}}</div>
      {{#if customer.phone}}<div class="muted">{{customer.phone}}</div>{{/if}}
      {{#if customer.email}}<div class="muted">{{customer.email}}</div>{{/if}}
    </section>
    {{/if}}

    {{#if showDayPlan}}{{#if itinerary.plan.length}}
    <section class="it-card">
      <div class="it-card-head"><span class="it-ico">&#9906;</span><h3>Itinerary Details</h3></div>
      {{#each itinerary.plan}}
      <div class="it-day">
        <div class="it-day-label">Day {{inc @index}}:</div>
        <div>
          <div class="it-day-title">{{this.title}}{{#if this.date}} <span class="muted" style="font-weight:400;">({{this.date}})</span>{{/if}}</div>
          {{#if this.description}}<div class="it-day-desc">{{this.description}}</div>{{/if}}
        </div>
      </div>
      {{/each}}
    </section>
    {{/if}}{{/if}}

    {{#if showVehicle}}{{#if itinerary.vehicle.features.length}}
    <section class="it-card">
      <div class="it-card-head"><span class="it-ico">&#128661;</span><h3>Vehicle Details</h3></div>
      <div class="it-veh-grid">
        {{#each itinerary.vehicle.features}}<div class="it-veh-item"><span class="it-tick">&#10004;</span>{{this}}</div>{{/each}}
      </div>
    </section>
    {{/if}}{{/if}}

    {{#if showHotels}}{{#if itinerary.hotels.length}}
    <section class="it-card">
      <div class="it-card-head"><span class="it-ico">&#127976;</span><h3>Hotel Details</h3></div>
      {{#each itinerary.hotels}}
      <div class="it-hotel">
        <div class="it-hotel-thumb">{{#if this.imageUrl}}<img src="{{this.imageUrl}}" alt="hotel" />{{else}}H{{/if}}</div>
        <div>
          <div class="it-hotel-name">{{this.name}}</div>
          {{#if this.roomType}}<div class="muted">{{this.roomType}}{{#if this.mealPlan}} - {{this.mealPlan}}{{/if}}</div>{{else}}{{#if this.mealPlan}}<div class="muted">{{this.mealPlan}}</div>{{/if}}{{/if}}
        </div>
        <div class="it-hotel-meta">{{this.category}}</div>
        <div class="it-hotel-meta">{{this.city}}</div>
        <div class="it-hotel-meta">{{#if this.nights}}Night: {{this.nights}}{{/if}}</div>
      </div>
      {{/each}}
    </section>
    {{/if}}{{/if}}

    {{#if showPriceBreakup}}
    <section class="it-card">
      <div class="it-card-head"><span class="it-ico">&#8377;</span><h3>Price Details</h3></div>
      <div class="it-price-grid">
        <div>
          {{#if trip.checkIn}}<div class="it-fact"><span>Check In</span><strong>{{trip.checkIn}}</strong></div>{{/if}}
          {{#if trip.checkOut}}<div class="it-fact"><span>Check Out</span><strong>{{trip.checkOut}}</strong></div>{{/if}}
          <div class="it-fact"><span>Nights</span><strong>{{trip.nights}}</strong></div>
          <div class="it-fact"><span>Adults</span><strong>{{trip.adults}}</strong></div>
          <div class="it-fact"><span>Child</span><strong>{{trip.children}}</strong></div>
        </div>
        <div class="it-price-right">
          {{#if itinerary.vehicle.type}}<div class="it-veh-type"><span class="it-tick">&#10004;</span>{{itinerary.vehicle.type}}</div>{{/if}}
          <div class="it-breakup-title">Price Breakup</div>
          {{#each itinerary.priceRooms}}
          <div class="it-breakup-row">
            <span>{{this.label}}</span>
            <span>{{#if this.rate}}{{../itinerary.pricing.currency}} {{money this.rate}}{{#if this.pax}} &times; {{this.pax}}{{/if}}{{/if}}</span>
            <span>{{../itinerary.pricing.currency}} {{money this.amount}}</span>
          </div>
          {{/each}}
          <div class="it-breakup-row strongrow"><span>Total Package Price</span><span></span><span>{{itinerary.pricing.currency}} {{money itinerary.pricing.packageTotal}}</span></div>
          {{#if itinerary.pricing.gstAmount}}<div class="it-breakup-row"><span>GST @ {{itinerary.pricing.gstPercent}}%</span><span></span><span>{{itinerary.pricing.currency}} {{money itinerary.pricing.gstAmount}}</span></div>{{/if}}
          <div class="it-breakup-row grandrow"><span>Gross Total</span><span></span><span>{{itinerary.pricing.currency}} {{money itinerary.pricing.grossTotal}}</span></div>
        </div>
      </div>
    </section>
    {{/if}}

    {{#if showInclusions}}{{#if itinerary.inclusions.length}}
    <section class="it-card">
      <div class="it-card-head"><span class="it-ico">&#10004;</span><h3>Inclusions</h3></div>
      {{#each itinerary.inclusions}}<div class="it-list-item"><span class="it-tick">&#10004;</span>{{this}}</div>{{/each}}
    </section>
    {{/if}}{{/if}}

    {{#if showExclusions}}{{#if itinerary.exclusions.length}}
    <section class="it-card">
      <div class="it-card-head"><span class="it-ico">&#10006;</span><h3>Exclusions</h3></div>
      {{#each itinerary.exclusions}}<div class="it-list-item"><span class="it-cross">&#10006;</span>{{this}}</div>{{/each}}
    </section>
    {{/if}}{{/if}}

    {{#if showTerms}}{{#if terms}}
    <section class="it-card">
      <div class="it-section-title">Terms &amp; Conditions</div>
      <div class="it-preline">{{terms}}</div>
    </section>
    {{/if}}{{/if}}

    {{#if showNotes}}{{#if notes}}
    <section class="it-card">
      <div class="it-section-title">Notes</div>
      <div class="it-preline">{{notes}}</div>
    </section>
    {{/if}}{{/if}}

    {{#if partner.brandName}}<div class="it-poweredby">Powered by {{partner.brandName}}</div>{{/if}}
  </main>

  {{#if showContactFooter}}
  <div class="it-band it-footer-band">
    {{#if agency.website}}<span>{{agency.website}}</span>{{/if}}
    {{#if agency.email}}<span>| Email: {{agency.email}}</span>{{/if}}
    {{#if agency.phone}}<span>| Call Us: {{agency.phone}}</span>{{/if}}
  </div>
  {{/if}}
</body>
</html>`;
}

function itineraryLogoOrName() {
  return `{{#if showLogo}}{{#if brand.logoUrl}}<img src="{{brand.logoUrl}}" alt="logo" />{{else}}{{#if agency.companyLogoUrl}}<img src="{{agency.companyLogoUrl}}" alt="logo" />{{else}}<span class="it-brand-name">{{#if brand.name}}{{brand.name}}{{else}}{{agency.name}}{{/if}}</span>{{/if}}{{/if}}{{else}}<span class="it-brand-name">{{#if brand.name}}{{brand.name}}{{else}}{{agency.name}}{{/if}}</span>{{/if}}`;
}

/** Itinerary — Modern (warm full-bleed header band, matches travel-brochure look). */
function itineraryModern() {
  const band = `
    <div class="it-band it-topbar">
      <div class="it-logo">${itineraryLogoOrName()}</div>
      <div class="it-summary">{{#if trip.summary}}{{trip.summary}}{{else}}{{header.title}}{{/if}}</div>
    </div>`;
  return itineraryShell(band).replace('{{partyLabelText}}', 'Prepared For');
}

/** Itinerary — Classic (centred header, serif-friendly). */
function itineraryClassic() {
  const band = `
    <div class="it-band" style="text-align:center; padding:18px 36px;">
      <div style="display:inline-flex; background:#fff; border-radius:8px; padding:6px 14px; align-items:center;">${itineraryLogoOrName()}</div>
      <div class="it-summary" style="margin-top:8px;">{{#if trip.summary}}{{trip.summary}}{{else}}{{header.title}}{{/if}}</div>
    </div>`;
  return itineraryShell(band).replace('{{partyLabelText}}', 'Prepared For');
}

/** Itinerary — Minimal (light header strip, brand accent only). */
function itineraryMinimal() {
  const band = `
    <div class="it-topbar" style="border-bottom:3px solid var(--brand); background:#fff;">
      <div class="it-logo" style="padding:0;">${itineraryLogoOrName()}</div>
      <div class="it-summary" style="color:var(--brand);">{{#if trip.summary}}{{trip.summary}}{{else}}{{header.title}}{{/if}}</div>
    </div>`;
  return itineraryShell(band).replace('{{partyLabelText}}', 'Prepared For');
}

const ITINERARY_LAYOUT_BUILDERS = {
  modern: itineraryModern,
  classic: itineraryClassic,
  minimal: itineraryMinimal,
};

const LAYOUT_BUILDERS = {
  modern: layoutModern,
  classic: layoutClassic,
  minimal: layoutMinimal,
};

const LAYOUT_LABELS = {
  modern: 'Modern',
  classic: 'Classic',
  minimal: 'Minimal',
};

/** Returns the Handlebars HTML for a given layout + document type. */
function templateHtml(type, layout) {
  if (type === 'itinerary') {
    const itBuilder = ITINERARY_LAYOUT_BUILDERS[layout] || ITINERARY_LAYOUT_BUILDERS.modern;
    return itBuilder();
  }
  const builder = LAYOUT_BUILDERS[layout] || LAYOUT_BUILDERS.modern;
  return builder(DOC_TYPES.includes(type) ? type : 'quotation');
}

/** Returns the preset catalogue (for the builder's layout picker). */
function presets(type) {
  return Object.keys(LAYOUT_BUILDERS).map((key) => ({
    key,
    name: LAYOUT_LABELS[key],
    html: templateHtml(type, key),
  }));
}

/** Registers the Handlebars helpers the templates rely on. Idempotent. */
function registerHelpers(Handlebars) {
  Handlebars.registerHelper('money', (v) => {
    const n = Number(v);
    return (Number.isFinite(n) ? n : 0).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  });
  Handlebars.registerHelper('inc', (v) => Number(v || 0) + 1);
  Handlebars.registerHelper('eq', (a, b) => a === b);
  Handlebars.registerHelper('fontStack', (font) => FONT_STACKS[font] || FONT_STACKS.Manrope);
  Handlebars.registerHelper('brandColor', (c) => (typeof c === 'string' && c.trim()) ? c : '#111827');
  // Overlay alpha for a background image: higher "opacity" => image more visible
  // => lighter overlay. Clamped 0–100, returns 0–1 with 2 decimals.
  Handlebars.registerHelper('bgOverlay', (v) => {
    const n = Math.max(0, Math.min(100, Number(v)));
    return ((100 - (Number.isFinite(n) ? n : 12)) / 100).toFixed(2);
  });
}

/**
 * Flattens a saved template `config` into the top-level flags the templates read
 * (showLogo, showTerms, etc.) and merges defaults so older/partial configs render.
 */
function flagsFromConfig(type, config) {
  const def = defaultConfig(type);
  const c = config || {};
  const fields = { ...def.fields, ...(c.fields || {}) };
  const header = { ...def.header, ...(c.header || {}) };
  const content = { ...def.content, ...(c.content || {}) };
  const showQrCode = fields.showQrCode !== undefined
    ? fields.showQrCode
    : !!(fields.showBankDetails && c.bank && c.bank.upiId);
  return {
    brand: { ...def.brand, ...(c.brand || {}) },
    header,
    fields,
    bank: { ...def.bank, ...(c.bank || {}) },
    showLogo: header.showLogo,
    showBankDetails: fields.showBankDetails,
    showQrCode,
    showSignatory: fields.showSignatory,
    showTerms: fields.showTerms,
    showNotes: fields.showNotes,
    showPaidStamp: fields.showPaidStamp,
    showGst: fields.showGst,
    // itinerary section toggles (undefined for other doc types — harmless)
    showDayPlan: fields.showDayPlan,
    showVehicle: fields.showVehicle,
    showHotels: fields.showHotels,
    showPriceBreakup: fields.showPriceBreakup,
    showInclusions: fields.showInclusions,
    showExclusions: fields.showExclusions,
    showContactFooter: fields.showContactFooter,
    terms: content.termsText,
    notes: content.notesText,
    footer: content.footerText,
  };
}

module.exports = {
  DOC_TYPES,
  DOC_META,
  FONT_STACKS,
  defaultConfig,
  templateHtml,
  presets,
  registerHelpers,
  flagsFromConfig,
};
