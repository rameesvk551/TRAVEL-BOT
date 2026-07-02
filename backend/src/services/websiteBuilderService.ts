const fs = require('fs/promises');
const path = require('path');
const { Op } = require('sequelize');
const { Agency } = require('../models');

const SITES_ROOT = path.resolve(__dirname, '../../public/sites');
const RESERVED_SUBDOMAINS = new Set(['api', 'app', 'admin', 'www', 'mail', 'ftp', 'localhost', 'travelbot']);
const WEBSITE_TEMPLATE_IDS = [
  'MODERN',
  'CLASSIC',
  'MINIMAL',
  'VIBRANT',
  'LUXURY_ESCAPE',
  'ADVENTURE_TREK',
  'FAMILY_HOLIDAY',
  'HONEYMOON',
  'CORPORATE_TRAVEL',
  'PILGRIMAGE',
];
const WEBSITE_TEMPLATES = {
  MODERN: {
    eyebrow: 'Travel experiences',
    bodyClass: 'bg-white text-neutral-950',
    headerClass: 'sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur',
    heroClass: 'relative overflow-hidden bg-neutral-950',
    heroImageClass: 'absolute inset-0 h-full w-full object-cover opacity-50',
    heroInnerClass: 'relative mx-auto flex min-h-[70vh] max-w-6xl flex-col justify-end px-4 pb-14 pt-24 text-white',
    primaryButtonClass: 'rounded-lg bg-white px-5 py-3 text-sm font-bold text-neutral-950',
    secondaryButtonClass: 'rounded-lg border border-white/40 px-5 py-3 text-sm font-bold text-white',
    sectionClass: 'mx-auto max-w-6xl px-4 py-14',
    bandClass: 'bg-neutral-50',
    cardClass: 'overflow-hidden rounded-lg border border-neutral-200 bg-white',
    formClass: 'rounded-lg border border-neutral-200 bg-white p-5 shadow-sm',
  },
  CLASSIC: {
    eyebrow: 'Curated journeys',
    bodyClass: 'bg-stone-50 text-neutral-950',
    headerClass: 'sticky top-0 z-30 border-b border-stone-200 bg-stone-50/95 backdrop-blur',
    heroClass: 'relative overflow-hidden bg-stone-950',
    heroImageClass: 'absolute inset-0 h-full w-full object-cover opacity-45 sepia',
    heroInnerClass: 'relative mx-auto flex min-h-[68vh] max-w-6xl flex-col justify-center px-4 py-24 text-white',
    primaryButtonClass: 'rounded-sm bg-white px-5 py-3 text-sm font-bold text-stone-950',
    secondaryButtonClass: 'rounded-sm border border-white/45 px-5 py-3 text-sm font-bold text-white',
    sectionClass: 'mx-auto max-w-6xl px-4 py-16',
    bandClass: 'bg-white',
    cardClass: 'overflow-hidden rounded-sm border border-stone-200 bg-white shadow-sm',
    formClass: 'rounded-sm border border-stone-200 bg-white p-5 shadow-sm',
  },
  MINIMAL: {
    eyebrow: 'Trips, stays, support',
    bodyClass: 'bg-white text-neutral-950',
    headerClass: 'sticky top-0 z-30 border-b border-neutral-100 bg-white/95 backdrop-blur',
    heroClass: 'relative overflow-hidden bg-white',
    heroImageClass: 'absolute right-0 top-0 h-full w-full object-cover opacity-20 grayscale',
    heroInnerClass: 'relative mx-auto flex min-h-[62vh] max-w-6xl flex-col justify-end px-4 pb-12 pt-24 text-neutral-950',
    primaryButtonClass: 'rounded-lg bg-neutral-950 px-5 py-3 text-sm font-bold text-white',
    secondaryButtonClass: 'rounded-lg border border-neutral-300 px-5 py-3 text-sm font-bold text-neutral-900',
    sectionClass: 'mx-auto max-w-6xl px-4 py-12',
    bandClass: 'bg-neutral-50',
    cardClass: 'overflow-hidden rounded-lg border border-neutral-100 bg-white',
    formClass: 'rounded-lg border border-neutral-100 bg-white p-5 shadow-sm',
  },
  VIBRANT: {
    eyebrow: 'Deals and departures',
    bodyClass: 'bg-white text-neutral-950',
    headerClass: 'sticky top-0 z-30 border-b border-fuchsia-100 bg-white/90 backdrop-blur',
    heroClass: 'relative overflow-hidden bg-fuchsia-950',
    heroImageClass: 'absolute inset-0 h-full w-full object-cover opacity-55 saturate-150',
    heroInnerClass: 'relative mx-auto flex min-h-[72vh] max-w-6xl flex-col justify-end px-4 pb-14 pt-24 text-white',
    primaryButtonClass: 'rounded-lg bg-white px-5 py-3 text-sm font-black text-fuchsia-950',
    secondaryButtonClass: 'rounded-lg border border-white/50 px-5 py-3 text-sm font-black text-white',
    sectionClass: 'mx-auto max-w-6xl px-4 py-14',
    bandClass: 'bg-amber-50',
    cardClass: 'overflow-hidden rounded-lg border border-fuchsia-100 bg-white shadow-sm',
    formClass: 'rounded-lg border border-fuchsia-100 bg-white p-5 shadow-sm',
  },
  LUXURY_ESCAPE: {
    eyebrow: 'Luxury escapes',
    bodyClass: 'bg-neutral-950 text-white',
    headerClass: 'sticky top-0 z-30 border-b border-white/10 bg-neutral-950/90 backdrop-blur',
    heroClass: 'relative overflow-hidden bg-black',
    heroImageClass: 'absolute inset-0 h-full w-full object-cover opacity-45',
    heroInnerClass: 'relative mx-auto flex min-h-[74vh] max-w-6xl flex-col justify-center px-4 py-24 text-white',
    primaryButtonClass: 'rounded-sm bg-white px-5 py-3 text-sm font-bold text-neutral-950',
    secondaryButtonClass: 'rounded-sm border border-white/35 px-5 py-3 text-sm font-bold text-white',
    sectionClass: 'mx-auto max-w-6xl px-4 py-16 text-white',
    bandClass: 'bg-neutral-900',
    cardClass: 'overflow-hidden rounded-sm border border-white/10 bg-neutral-900 text-white',
    formClass: 'rounded-sm border border-white/10 bg-neutral-900 p-5 shadow-sm',
  },
  ADVENTURE_TREK: {
    eyebrow: 'Adventure departures',
    bodyClass: 'bg-lime-50 text-neutral-950',
    headerClass: 'sticky top-0 z-30 border-b border-lime-200 bg-lime-50/95 backdrop-blur',
    heroClass: 'relative overflow-hidden bg-emerald-950',
    heroImageClass: 'absolute inset-0 h-full w-full object-cover opacity-55 contrast-125',
    heroInnerClass: 'relative mx-auto flex min-h-[72vh] max-w-6xl flex-col justify-end px-4 pb-14 pt-24 text-white',
    primaryButtonClass: 'rounded-lg bg-lime-300 px-5 py-3 text-sm font-black text-emerald-950',
    secondaryButtonClass: 'rounded-lg border border-lime-200/70 px-5 py-3 text-sm font-black text-white',
    sectionClass: 'mx-auto max-w-6xl px-4 py-14',
    bandClass: 'bg-white',
    cardClass: 'overflow-hidden rounded-lg border border-lime-200 bg-white shadow-sm',
    formClass: 'rounded-lg border border-lime-200 bg-white p-5 shadow-sm',
  },
  FAMILY_HOLIDAY: {
    eyebrow: 'Family holidays',
    bodyClass: 'bg-sky-50 text-neutral-950',
    headerClass: 'sticky top-0 z-30 border-b border-sky-100 bg-white/90 backdrop-blur',
    heroClass: 'relative overflow-hidden bg-sky-950',
    heroImageClass: 'absolute inset-0 h-full w-full object-cover opacity-50',
    heroInnerClass: 'relative mx-auto flex min-h-[70vh] max-w-6xl flex-col justify-end px-4 pb-14 pt-24 text-white',
    primaryButtonClass: 'rounded-lg bg-white px-5 py-3 text-sm font-bold text-sky-950',
    secondaryButtonClass: 'rounded-lg border border-white/40 px-5 py-3 text-sm font-bold text-white',
    sectionClass: 'mx-auto max-w-6xl px-4 py-14',
    bandClass: 'bg-white',
    cardClass: 'overflow-hidden rounded-lg border border-sky-100 bg-white shadow-sm',
    formClass: 'rounded-lg border border-sky-100 bg-white p-5 shadow-sm',
  },
  HONEYMOON: {
    eyebrow: 'Romantic getaways',
    bodyClass: 'bg-rose-50 text-neutral-950',
    headerClass: 'sticky top-0 z-30 border-b border-rose-100 bg-rose-50/95 backdrop-blur',
    heroClass: 'relative overflow-hidden bg-rose-950',
    heroImageClass: 'absolute inset-0 h-full w-full object-cover opacity-50 saturate-125',
    heroInnerClass: 'relative mx-auto flex min-h-[72vh] max-w-6xl flex-col justify-center px-4 py-24 text-white',
    primaryButtonClass: 'rounded-lg bg-white px-5 py-3 text-sm font-bold text-rose-950',
    secondaryButtonClass: 'rounded-lg border border-white/45 px-5 py-3 text-sm font-bold text-white',
    sectionClass: 'mx-auto max-w-6xl px-4 py-14',
    bandClass: 'bg-white',
    cardClass: 'overflow-hidden rounded-lg border border-rose-100 bg-white shadow-sm',
    formClass: 'rounded-lg border border-rose-100 bg-white p-5 shadow-sm',
  },
  CORPORATE_TRAVEL: {
    eyebrow: 'Business travel',
    bodyClass: 'bg-slate-50 text-slate-950',
    headerClass: 'sticky top-0 z-30 border-b border-slate-200 bg-white/95 backdrop-blur',
    heroClass: 'relative overflow-hidden bg-slate-950',
    heroImageClass: 'absolute inset-0 h-full w-full object-cover opacity-40 grayscale',
    heroInnerClass: 'relative mx-auto flex min-h-[64vh] max-w-6xl flex-col justify-center px-4 py-24 text-white',
    primaryButtonClass: 'rounded-md bg-white px-5 py-3 text-sm font-bold text-slate-950',
    secondaryButtonClass: 'rounded-md border border-white/45 px-5 py-3 text-sm font-bold text-white',
    sectionClass: 'mx-auto max-w-6xl px-4 py-12',
    bandClass: 'bg-white',
    cardClass: 'overflow-hidden rounded-md border border-slate-200 bg-white shadow-sm',
    formClass: 'rounded-md border border-slate-200 bg-white p-5 shadow-sm',
  },
  PILGRIMAGE: {
    eyebrow: 'Pilgrimage tours',
    bodyClass: 'bg-orange-50 text-neutral-950',
    headerClass: 'sticky top-0 z-30 border-b border-orange-100 bg-orange-50/95 backdrop-blur',
    heroClass: 'relative overflow-hidden bg-orange-950',
    heroImageClass: 'absolute inset-0 h-full w-full object-cover opacity-45 sepia',
    heroInnerClass: 'relative mx-auto flex min-h-[70vh] max-w-6xl flex-col justify-end px-4 pb-14 pt-24 text-white',
    primaryButtonClass: 'rounded-lg bg-white px-5 py-3 text-sm font-bold text-orange-950',
    secondaryButtonClass: 'rounded-lg border border-white/45 px-5 py-3 text-sm font-bold text-white',
    sectionClass: 'mx-auto max-w-6xl px-4 py-14',
    bandClass: 'bg-white',
    cardClass: 'overflow-hidden rounded-lg border border-orange-100 bg-white shadow-sm',
    formClass: 'rounded-lg border border-orange-100 bg-white p-5 shadow-sm',
  },
};

function websiteTemplate(theme) {
  return WEBSITE_TEMPLATES[theme] || WEBSITE_TEMPLATES.MODERN;
}

function templateCss(theme) {
  return `
    body[data-template="CLASSIC"] { font-family: Georgia, "Times New Roman", serif; }
    body[data-template="CLASSIC"] h1,
    body[data-template="CLASSIC"] h2,
    body[data-template="CLASSIC"] h3 { font-family: Georgia, "Times New Roman", serif; font-weight: 700; }
    body[data-template="CLASSIC"] .catalog-card { border-left: 4px solid var(--brand); }

    body[data-template="MINIMAL"] #packages-grid,
    body[data-template="MINIMAL"] #properties-grid,
    body[data-template="CORPORATE_TRAVEL"] #packages-grid,
    body[data-template="CORPORATE_TRAVEL"] #properties-grid { display: grid; grid-template-columns: 1fr; }
    body[data-template="MINIMAL"] .catalog-card,
    body[data-template="CORPORATE_TRAVEL"] .catalog-card { display: grid; grid-template-columns: minmax(180px, 32%) 1fr; align-items: stretch; }
    body[data-template="MINIMAL"] .catalog-card .card-media,
    body[data-template="CORPORATE_TRAVEL"] .catalog-card .card-media { height: 100%; min-height: 180px; aspect-ratio: auto; }
    body[data-template="MINIMAL"] .catalog-card { box-shadow: none; }
    body[data-template="MINIMAL"] .catalog-card .card-content { padding: 1.35rem; }

    body[data-template="VIBRANT"] .catalog-card { box-shadow: 0 18px 45px rgba(192, 38, 211, 0.14); border-top: 5px solid var(--brand); }
    body[data-template="VIBRANT"] #packages-grid article:nth-child(2n) { transform: translateY(18px); }

    body[data-template="LUXURY_ESCAPE"] h2,
    body[data-template="LUXURY_ESCAPE"] .brand-text { color: #d6b46d; }
    body[data-template="LUXURY_ESCAPE"] .catalog-card { box-shadow: 0 24px 60px rgba(0, 0, 0, 0.35); }
    body[data-template="LUXURY_ESCAPE"] .catalog-card p { color: rgba(255,255,255,0.68); }
    body[data-template="LUXURY_ESCAPE"] .catalog-card h3,
    body[data-template="LUXURY_ESCAPE"] .catalog-card .price { color: #fff; }
    body[data-template="LUXURY_ESCAPE"] input,
    body[data-template="LUXURY_ESCAPE"] textarea { background: #111827; border-color: rgba(255,255,255,0.14); color: #fff; }

    body[data-template="ADVENTURE_TREK"] .catalog-card { border-radius: 0.35rem; box-shadow: 0 16px 36px rgba(22, 101, 52, 0.12); }
    body[data-template="ADVENTURE_TREK"] .catalog-card .card-media { clip-path: polygon(0 0, 100% 0, 100% 90%, 0 100%); }

    body[data-template="FAMILY_HOLIDAY"] .catalog-card,
    body[data-template="FAMILY_HOLIDAY"] form { border-radius: 1.5rem; box-shadow: 0 16px 40px rgba(2, 132, 199, 0.10); }
    body[data-template="FAMILY_HOLIDAY"] .catalog-card .card-media { border-radius: 1.25rem; margin: 0.75rem; margin-bottom: 0; overflow: hidden; }

    body[data-template="HONEYMOON"] .catalog-card { border-radius: 1.5rem; box-shadow: 0 18px 45px rgba(225, 29, 72, 0.12); }
    body[data-template="HONEYMOON"] .catalog-card .card-media { border-radius: 1.5rem 1.5rem 0 0; }
    body[data-template="HONEYMOON"] h2 { font-family: Georgia, "Times New Roman", serif; font-style: italic; }

    body[data-template="CORPORATE_TRAVEL"] .catalog-card { border-left: 5px solid #334155; box-shadow: none; }
    body[data-template="CORPORATE_TRAVEL"] .catalog-card .card-content { display: grid; grid-template-columns: 1fr auto; gap: 0.75rem 1.25rem; align-items: start; }
    body[data-template="CORPORATE_TRAVEL"] .catalog-card .description { grid-column: 1 / -1; }
    body[data-template="CORPORATE_TRAVEL"] .catalog-card button { grid-column: 1 / -1; justify-self: start; }

    body[data-template="PILGRIMAGE"] { font-family: Georgia, "Times New Roman", serif; }
    body[data-template="PILGRIMAGE"] .catalog-card { text-align: center; border-color: rgba(234, 88, 12, 0.18); }
    body[data-template="PILGRIMAGE"] .catalog-card .card-media img { filter: sepia(0.24) saturate(0.9); }

    @media (max-width: 720px) {
      body[data-template="MINIMAL"] .catalog-card,
      body[data-template="CORPORATE_TRAVEL"] .catalog-card { grid-template-columns: 1fr; }
      body[data-template="MINIMAL"] .catalog-card .card-media,
      body[data-template="CORPORATE_TRAVEL"] .catalog-card .card-media { min-height: 0; aspect-ratio: 4 / 2.35; }
      body[data-template="VIBRANT"] #packages-grid article:nth-child(2n) { transform: none; }
    }
  `;
}

function normalizeHost(value = '') {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  try {
    const parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
    return parsed.hostname.replace(/\.$/, '');
  } catch (_err) {
    return raw.split('/')[0].split(':')[0].replace(/\.$/, '');
  }
}

function normalizeSubdomain(value = '') {
  const slug = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);

  if (slug.length < 3 || RESERVED_SUBDOMAINS.has(slug)) return '';
  return slug;
}

function normalizeDomain(value = '') {
  const host = normalizeHost(value);
  if (!host || host.length > 253) return '';
  if (host === 'localhost' || host.endsWith('.localhost')) return '';
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) return '';
  if (!/^[a-z0-9.-]+$/.test(host)) return '';
  if (!host.includes('.') || host.includes('..')) return '';
  return host;
}

function publicRootDomain() {
  return normalizeDomain(process.env.PUBLIC_SITE_ROOT_DOMAIN || '');
}

function adminHost() {
  return normalizeHost(process.env.ADMIN_APP_HOST || process.env.BASE_URL || '');
}

function sitePath(agencyId) {
  return path.join(SITES_ROOT, agencyId);
}

function publicUrlForAgency(agency) {
  if (agency.customDomain) return `https://${agency.customDomain}`;
  const root = publicRootDomain();
  if (agency.subdomain && root) return `https://${agency.subdomain}.${root}`;
  return `/sites/${agency.id}/`;
}

function escapeHtml(value = '') {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function publicAgencyPayload(agency) {
  return {
    id: agency.id,
    name: agency.name,
    subdomain: agency.subdomain || null,
    customDomain: agency.customDomain || null,
    websiteEnabled: Boolean(agency.websiteEnabled),
    websiteTheme: WEBSITE_TEMPLATE_IDS.includes(agency.websiteTheme) ? agency.websiteTheme : 'MODERN',
    websiteTitle: agency.websiteTitle || agency.name,
    websiteDescription: agency.websiteDescription || '',
    websiteLogoUrl: agency.websiteLogoUrl || '',
    websitePrimaryColor: agency.websitePrimaryColor || '#00A884',
    websiteHeroImageUrl: agency.websiteHeroImageUrl || '',
    websiteContactPhone: agency.websiteContactPhone || agency.whatsappDisplayPhoneNumber || agency.whatsappNumber || agency.phone || '',
    websiteContactEmail: agency.websiteContactEmail || agency.email || '',
    websiteSocialLinks: agency.websiteSocialLinks || {},
    websiteSeoMeta: agency.websiteSeoMeta || {},
    websiteCustomCss: agency.websiteCustomCss || '',
    websitePublishedAt: agency.websitePublishedAt || null,
    publicUrl: publicUrlForAgency(agency),
  };
}

function renderStaticSite(agency) {
  const payload = publicAgencyPayload(agency);
  const template = websiteTemplate(payload.websiteTheme);
  const title = payload.websiteSeoMeta.title || payload.websiteTitle || payload.name;
  const description = payload.websiteSeoMeta.description || payload.websiteDescription || `Travel packages and stays from ${payload.name}`;
  const css = agency.websiteCustomCss || '';
  const apiKey = encodeURIComponent(agency.id);

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <script src="https://cdn.tailwindcss.com"></script>
  <style>
    :root { --brand: ${escapeHtml(payload.websitePrimaryColor)}; }
    body { font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    .brand-bg { background: var(--brand); }
    .brand-text { color: var(--brand); }
    .brand-border { border-color: var(--brand); }
    ${templateCss(payload.websiteTheme)}
    ${css}
  </style>
</head>
<body class="${template.bodyClass}" data-template="${escapeHtml(payload.websiteTheme)}">
  <header class="${template.headerClass}">
    <div class="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
      <a href="/" class="flex min-w-0 items-center gap-3">
        ${payload.websiteLogoUrl ? `<img src="${escapeHtml(payload.websiteLogoUrl)}" alt="" class="h-10 w-10 rounded-lg object-cover">` : '<span class="brand-bg flex h-10 w-10 items-center justify-center rounded-lg text-sm font-black text-white">W</span>'}
        <span class="truncate text-sm font-black">${escapeHtml(payload.websiteTitle || payload.name)}</span>
      </a>
      <nav class="hidden gap-5 text-sm font-semibold text-neutral-600 sm:flex">
        <a href="#packages">Packages</a>
        <a href="#properties">Properties</a>
        <a href="#enquiry">Enquiry</a>
      </nav>
    </div>
  </header>

  <main>
    <section class="${template.heroClass}">
      ${payload.websiteHeroImageUrl ? `<img src="${escapeHtml(payload.websiteHeroImageUrl)}" alt="" class="${template.heroImageClass}">` : ''}
      <div class="${template.heroInnerClass}">
        <p class="text-xs font-bold uppercase tracking-[0.22em] opacity-70">${escapeHtml(template.eyebrow)}</p>
        <h1 class="mt-4 max-w-3xl text-4xl font-black leading-tight sm:text-6xl">${escapeHtml(payload.websiteTitle || payload.name)}</h1>
        <p class="mt-5 max-w-2xl text-base leading-7 opacity-85">${escapeHtml(payload.websiteDescription || 'Explore curated packages, stays, and travel support from our team.')}</p>
        <div class="mt-7 flex flex-wrap gap-3">
          <a href="#packages" class="${template.primaryButtonClass}">Explore packages</a>
          <a href="#enquiry" class="${template.secondaryButtonClass}">Send enquiry</a>
        </div>
      </div>
    </section>

    <section id="packages" class="${template.sectionClass}">
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">Packages</p>
      <h2 class="mt-2 text-3xl font-black">Featured trips</h2>
      <div id="packages-grid" class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"></div>
    </section>

    <section class="${template.bandClass}">
      <div class="${template.sectionClass}">
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">Properties</p>
        <h2 class="mt-2 text-3xl font-black">Stays and properties</h2>
        <div id="properties-grid" class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"></div>
      </div>
    </section>

    <section id="enquiry" class="mx-auto grid max-w-6xl gap-8 px-4 py-14 lg:grid-cols-[0.8fr_1.2fr]">
      <div>
        <p class="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">Contact</p>
        <h2 class="mt-2 text-3xl font-black">Plan with us</h2>
        <p class="mt-4 text-sm leading-7 text-neutral-600">Share your details and the team will follow up.</p>
        <div class="mt-6 space-y-2 text-sm text-neutral-700">
          ${payload.websiteContactPhone ? `<p>Phone: ${escapeHtml(payload.websiteContactPhone)}</p>` : ''}
          ${payload.websiteContactEmail ? `<p>Email: ${escapeHtml(payload.websiteContactEmail)}</p>` : ''}
        </div>
      </div>
      <form id="enquiry-form" class="${template.formClass}">
        <div id="form-message" class="mb-4 hidden rounded-lg px-3 py-2 text-sm"></div>
        <input id="selected-item-type" type="hidden">
        <input id="selected-item-id" type="hidden">
        <input name="company" class="hidden" tabindex="-1" autocomplete="off">
        <div class="grid gap-4 sm:grid-cols-2">
          <input name="name" required class="rounded-lg border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-500" placeholder="Name">
          <input name="phone" required class="rounded-lg border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-500" placeholder="Phone">
          <input name="email" class="rounded-lg border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-500" placeholder="Email">
          <input name="destination" class="rounded-lg border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-500" placeholder="Destination">
          <input name="travelDates" class="rounded-lg border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-500" placeholder="Travel dates">
          <input name="travellers" type="number" min="1" class="rounded-lg border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-500" placeholder="Travellers">
          <textarea name="message" class="min-h-28 rounded-lg border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-neutral-500 sm:col-span-2" placeholder="Message"></textarea>
        </div>
        <button class="brand-bg mt-5 w-full rounded-lg px-5 py-3 text-sm font-bold text-white" type="submit">Send enquiry</button>
      </form>
    </section>
  </main>

  <script>
    const AGENCY_KEY = "${apiKey}";
    const money = (paise) => {
      const amount = Math.round(Number(paise || 0) / 100);
      return amount ? "INR " + amount.toLocaleString("en-IN") : "On request";
    };
    const esc = (value) => String(value || "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[char]));
    const card = (item, type) => {
      const image = item.imageUrl || (item.images && item.images[0]) || "";
      const subtitle = type === "PACKAGE"
        ? [item.duration, ...(item.destinations || []).slice(0, 2)].filter(Boolean).join(" | ")
        : [item.propertyType, item.location].filter(Boolean).join(" | ");
      const price = type === "PACKAGE" ? money(item.basePrice) : money(item.pricePerNight);
      return \`<article class="catalog-card ${template.cardClass}">
        <div class="card-media aspect-[4/2.35] bg-neutral-100">\${image ? \`<img src="\${esc(image)}" alt="\${esc(item.name)}" class="h-full w-full object-cover">\` : ""}</div>
        <div class="card-content p-4">
          <p class="text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">\${type === "PACKAGE" ? esc(item.category || "Package") : "Stay"}</p>
          <h3 class="mt-2 text-lg font-bold">\${esc(item.name)}</h3>
          <p class="mt-1 text-sm text-neutral-500">\${esc(subtitle)}</p>
          <p class="price mt-3 text-sm font-bold">\${price}</p>
          <p class="description mt-3 line-clamp-3 text-sm leading-6 text-neutral-600">\${esc(item.summary || item.description || "Contact us for details.")}</p>
          <button class="brand-text mt-4 text-sm font-black" data-type="\${type}" data-id="\${item.id}" data-name="\${esc(item.name)}">Enquire now</button>
        </div>
      </article>\`;
    };
    async function loadCatalog() {
      const [packagesRes, propertiesRes] = await Promise.all([
        fetch(\`/public/\${AGENCY_KEY}/packages\`),
        fetch(\`/public/\${AGENCY_KEY}/properties\`)
      ]);
      const packages = await packagesRes.json();
      const properties = await propertiesRes.json();
      document.getElementById("packages-grid").innerHTML = (packages.data || []).map((item) => card(item, "PACKAGE")).join("") || '<p class="text-sm text-neutral-500">Packages will appear here soon.</p>';
      document.getElementById("properties-grid").innerHTML = (properties.data || []).map((item) => card(item, "PROPERTY")).join("") || '<p class="text-sm text-neutral-500">Properties will appear here soon.</p>';
    }
    document.addEventListener("click", (event) => {
      const button = event.target.closest("[data-type][data-id]");
      if (!button) return;
      document.getElementById("selected-item-type").value = button.dataset.type;
      document.getElementById("selected-item-id").value = button.dataset.id;
      document.querySelector("[name=message]").value = \`I am interested in \${button.dataset.name}.\`;
      document.getElementById("enquiry").scrollIntoView({ behavior: "smooth" });
    });
    document.getElementById("enquiry-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const payload = Object.fromEntries(new FormData(form).entries());
      payload.itemType = document.getElementById("selected-item-type").value || "CUSTOM_TRIP";
      payload.itemId = document.getElementById("selected-item-id").value || undefined;
      const msg = document.getElementById("form-message");
      msg.className = "mb-4 rounded-lg px-3 py-2 text-sm bg-neutral-100 text-neutral-700";
      msg.textContent = "Sending...";
      try {
        const response = await fetch(\`/public/\${AGENCY_KEY}/enquiry\`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        if (!response.ok) throw new Error("Could not send enquiry");
        msg.className = "mb-4 rounded-lg px-3 py-2 text-sm bg-emerald-50 text-emerald-700";
        msg.textContent = "Thanks. Your enquiry has been sent.";
        form.reset();
      } catch (err) {
        msg.className = "mb-4 rounded-lg px-3 py-2 text-sm bg-rose-50 text-rose-700";
        msg.textContent = err.message || "Could not send enquiry.";
      }
    });
    loadCatalog().catch(() => {
      document.getElementById("packages-grid").innerHTML = '<p class="text-sm text-neutral-500">Could not load packages.</p>';
    });
  </script>
</body>
</html>`;
}

async function assertUniqueDomains(agencyId, values = {}) {
  const or = [];
  if (values.subdomain) or.push({ subdomain: values.subdomain });
  if (values.customDomain) or.push({ customDomain: values.customDomain });
  if (!or.length) return;

  const existing = await Agency.findOne({
    where: {
      id: { [Op.ne]: agencyId },
      [Op.or]: or,
    },
  });

  if (existing) {
    throw Object.assign(new Error('Website domain is already used by another agency'), {
      statusCode: 409,
      code: 'WEBSITE_DOMAIN_TAKEN',
    });
  }
}

async function updateWebsiteSettings(agencyId, updates = {}) {
  const agency = await Agency.findByPk(agencyId);
  if (!agency) throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'NOT_FOUND' });

  const payload = {};
  if (updates.subdomain !== undefined) payload.subdomain = normalizeSubdomain(updates.subdomain) || null;
  if (updates.customDomain !== undefined) payload.customDomain = normalizeDomain(updates.customDomain) || null;

  const stringFields = [
    'websiteTheme',
    'websiteTitle',
    'websiteDescription',
    'websiteLogoUrl',
    'websitePrimaryColor',
    'websiteHeroImageUrl',
    'websiteContactPhone',
    'websiteContactEmail',
    'websiteCustomCss',
  ];

  for (const field of stringFields) {
    if (updates[field] !== undefined) {
      const value = String(updates[field] || '').trim();
      payload[field] = value || null;
    }
  }

  if (payload.websitePrimaryColor && !/^#[0-9a-f]{6}$/i.test(payload.websitePrimaryColor)) {
    payload.websitePrimaryColor = agency.websitePrimaryColor || '#00A884';
  }

  if (updates.websiteSocialLinks && typeof updates.websiteSocialLinks === 'object') {
    payload.websiteSocialLinks = updates.websiteSocialLinks;
  }
  if (updates.websiteSeoMeta && typeof updates.websiteSeoMeta === 'object') {
    payload.websiteSeoMeta = updates.websiteSeoMeta;
  }

  await assertUniqueDomains(agencyId, {
    subdomain: payload.subdomain,
    customDomain: payload.customDomain,
  });

  await agency.update(payload);
  return getWebsiteStatus(agencyId);
}

async function generateWebsite(agencyId) {
  const agency = await Agency.findByPk(agencyId);
  if (!agency) throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'NOT_FOUND' });
  if (!agency.subdomain && !agency.customDomain) {
    throw Object.assign(new Error('Add a subdomain or custom domain before publishing'), {
      statusCode: 400,
      code: 'WEBSITE_DOMAIN_REQUIRED',
    });
  }

  const dir = sitePath(agency.id);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, 'index.html'), renderStaticSite(agency), 'utf8');
  await agency.update({ websiteEnabled: true, websitePublishedAt: new Date() });
  return getWebsiteStatus(agencyId);
}

async function unpublishWebsite(agencyId) {
  const agency = await Agency.findByPk(agencyId);
  if (!agency) throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'NOT_FOUND' });
  await agency.update({ websiteEnabled: false });
  return getWebsiteStatus(agencyId);
}

async function getWebsiteStatus(agencyId) {
  const agency = await Agency.findByPk(agencyId);
  if (!agency) throw Object.assign(new Error('Agency not found'), { statusCode: 404, code: 'NOT_FOUND' });
  const data = publicAgencyPayload(agency);
  return {
    ...data,
    publicRootDomain: publicRootDomain() || null,
    adminHost: adminHost() || null,
    staticPath: sitePath(agency.id),
    previewPath: `/sites/${agency.id}/`,
    hasGeneratedFiles: await fs.access(path.join(sitePath(agency.id), 'index.html')).then(() => true).catch(() => false),
  };
}

module.exports = {
  SITES_ROOT,
  normalizeHost,
  normalizeSubdomain,
  normalizeDomain,
  publicRootDomain,
  adminHost,
  sitePath,
  publicAgencyPayload,
  updateWebsiteSettings,
  generateWebsite,
  unpublishWebsite,
  getWebsiteStatus,
};
