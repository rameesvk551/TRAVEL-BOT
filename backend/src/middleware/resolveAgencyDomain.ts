// Serves the React app on an agency's own host (custom domain or platform
// subdomain) so it can render that agency's public catalog mini-site. This runs
// only for hosts that map to a published, catalog-entitled agency; every other
// host (the admin app, localhost, unknown domains) falls straight through to the
// normal API/app handling.
//
// There are no generated files anymore — the catalog is live React reading the
// /public/:agencyKey/catalog API. We serve the SPA bundle (index.html + assets)
// and let the app resolve the agency from window.location.host.

const fs = require('fs');
const path = require('path');
const express = require('express');
const { Op } = require('sequelize');
const { Agency } = require('../models');
const websiteBuilderService = require('../services/websiteBuilderService');

// Where the built frontend lives when the backend also fronts custom domains.
// Mirrors mediaService's web-root discovery; overridable with FRONTEND_DIST.
const WEB_ROOT_CANDIDATES = [
  process.env.FRONTEND_DIST,
  process.env.PUBLIC_WEB_ROOT,
  '/home/ec2-user/travel-bot-frontend-release',
  '/var/www/travel-bot',
  path.resolve(__dirname, '../../../frontend/dist'),
  path.resolve(__dirname, '../../public'),
].filter(Boolean);

let cachedWebRoot;
function resolveWebRoot() {
  if (cachedWebRoot !== undefined) return cachedWebRoot;
  cachedWebRoot = WEB_ROOT_CANDIDATES.find((dir) => {
    try {
      return fs.existsSync(path.join(dir, 'index.html'));
    } catch (_err) {
      return false;
    }
  }) || null;
  return cachedWebRoot;
}

const staticHandlers = new Map();
function getStaticHandler(webRoot) {
  if (!staticHandlers.has(webRoot)) {
    staticHandlers.set(webRoot, express.static(webRoot, { index: false }));
  }
  return staticHandlers.get(webRoot);
}

// Content served on an agency's own domain: inline styles (theme tokens), Google
// Fonts, and remote images (Cloudinary) are all needed by the catalog.
const CATALOG_CSP = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com data:",
  "img-src 'self' data: https:",
  "connect-src 'self' https:",
].join('; ');

function shouldSkip(req) {
  return req.path.startsWith('/api/')
    || req.path === '/api'
    || req.path.startsWith('/public/')
    || req.path === '/public'
    || req.path === '/health'
    || req.path === '/webhook';
}

async function resolveAgencyDomain(req, res, next) {
  if (shouldSkip(req)) return next();

  const host = websiteBuilderService.normalizeHost(req.headers['x-forwarded-host'] || req.headers.host);
  if (!host || host === 'localhost' || host === '127.0.0.1') return next();
  if (host === websiteBuilderService.adminHost()) return next();

  const rootDomain = websiteBuilderService.publicRootDomain();
  const or = [{ customDomain: host }];
  if (rootDomain && host.endsWith(`.${rootDomain}`)) {
    const subdomain = host.slice(0, -(rootDomain.length + 1));
    if (subdomain && !subdomain.includes('.')) or.push({ subdomain });
  }

  let agency;
  try {
    agency = await Agency.findOne({
      where: { isActive: true, websiteEnabled: true, [Op.or]: or },
    });
  } catch (err) {
    return next(err);
  }

  const entitled = agency
    && agency.features
    && typeof agency.features === 'object'
    && agency.features.catalogSite === true;
  if (!agency || !entitled) return next();

  const webRoot = resolveWebRoot();
  // No bundle co-located with the backend (e.g. nginx serves the SPA and only
  // proxies /api here). Nothing to serve — let the request fall through.
  if (!webRoot) return next();

  res.setHeader('Content-Security-Policy', CATALOG_CSP);

  // Serve real files (JS/CSS/assets) first; anything else is a client route, so
  // hand back index.html and let React Router render the catalog.
  return getStaticHandler(webRoot)(req, res, (err) => {
    if (err) return next(err);
    return res.sendFile(path.join(webRoot, 'index.html'), (sendErr) => {
      if (sendErr) next(sendErr);
    });
  });
}

module.exports = resolveAgencyDomain;
