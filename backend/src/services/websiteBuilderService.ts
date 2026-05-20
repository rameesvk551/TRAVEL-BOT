const fs = require('fs/promises');
const path = require('path');
const { Op } = require('sequelize');
const { Agency } = require('../models');

const SITES_ROOT = path.resolve(__dirname, '../../public/sites');
const RESERVED_SUBDOMAINS = new Set(['api', 'app', 'admin', 'www', 'mail', 'ftp', 'localhost', 'travelbot']);

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
    websiteTheme: agency.websiteTheme || 'MODERN',
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
    ${css}
  </style>
</head>
<body class="bg-white text-neutral-950">
  <header class="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur">
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
    <section class="relative overflow-hidden bg-neutral-950">
      ${payload.websiteHeroImageUrl ? `<img src="${escapeHtml(payload.websiteHeroImageUrl)}" alt="" class="absolute inset-0 h-full w-full object-cover opacity-50">` : ''}
      <div class="relative mx-auto flex min-h-[70vh] max-w-6xl flex-col justify-end px-4 pb-14 pt-24 text-white">
        <p class="text-xs font-bold uppercase tracking-[0.22em] text-white/70">Travel experiences</p>
        <h1 class="mt-4 max-w-3xl text-4xl font-black leading-tight sm:text-6xl">${escapeHtml(payload.websiteTitle || payload.name)}</h1>
        <p class="mt-5 max-w-2xl text-base leading-7 text-white/85">${escapeHtml(payload.websiteDescription || 'Explore curated packages, stays, and travel support from our team.')}</p>
        <div class="mt-7 flex flex-wrap gap-3">
          <a href="#packages" class="rounded-lg bg-white px-5 py-3 text-sm font-bold text-neutral-950">Explore packages</a>
          <a href="#enquiry" class="rounded-lg border border-white/40 px-5 py-3 text-sm font-bold text-white">Send enquiry</a>
        </div>
      </div>
    </section>

    <section id="packages" class="mx-auto max-w-6xl px-4 py-14">
      <p class="text-xs font-bold uppercase tracking-[0.2em] text-neutral-400">Packages</p>
      <h2 class="mt-2 text-3xl font-black">Featured trips</h2>
      <div id="packages-grid" class="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"></div>
    </section>

    <section class="bg-neutral-50">
      <div class="mx-auto max-w-6xl px-4 py-14">
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
      <form id="enquiry-form" class="rounded-lg border border-neutral-200 bg-white p-5 shadow-sm">
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
      return \`<article class="overflow-hidden rounded-lg border border-neutral-200 bg-white">
        <div class="aspect-[4/2.35] bg-neutral-100">\${image ? \`<img src="\${esc(image)}" alt="\${esc(item.name)}" class="h-full w-full object-cover">\` : ""}</div>
        <div class="p-4">
          <p class="text-xs font-bold uppercase tracking-[0.16em] text-neutral-400">\${type === "PACKAGE" ? esc(item.category || "Package") : "Stay"}</p>
          <h3 class="mt-2 text-lg font-bold">\${esc(item.name)}</h3>
          <p class="mt-1 text-sm text-neutral-500">\${esc(subtitle)}</p>
          <p class="mt-3 text-sm font-bold">\${price}</p>
          <p class="mt-3 line-clamp-3 text-sm leading-6 text-neutral-600">\${esc(item.summary || item.description || "Contact us for details.")}</p>
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
