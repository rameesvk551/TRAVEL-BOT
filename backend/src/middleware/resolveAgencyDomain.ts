const path = require('path');
const express = require('express');
const { Op } = require('sequelize');
const { Agency } = require('../models');
const websiteBuilderService = require('../services/websiteBuilderService');

const staticHandlers = new Map();

function getStaticHandler(agencyId) {
  if (!staticHandlers.has(agencyId)) {
    staticHandlers.set(agencyId, express.static(websiteBuilderService.sitePath(agencyId), {
      extensions: ['html'],
      index: 'index.html',
    }));
  }
  return staticHandlers.get(agencyId);
}

function shouldSkip(req) {
  return req.path.startsWith('/api/')
    || req.path === '/api'
    || req.path.startsWith('/public/')
    || req.path === '/public'
    || req.path.startsWith('/sites/')
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

  const agency = await Agency.findOne({
    where: {
      isActive: true,
      websiteEnabled: true,
      [Op.or]: or,
    },
  });

  if (!agency) {
    return res.status(404).send('Website not found');
  }

  req.publicAgency = agency;
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self';"
  );
  return getStaticHandler(agency.id)(req, res, (err) => {
    if (err) return next(err);
    return res.sendFile(path.join(websiteBuilderService.sitePath(agency.id), 'index.html'), (sendErr) => {
      if (sendErr) next(sendErr);
    });
  });
}

module.exports = resolveAgencyDomain;
