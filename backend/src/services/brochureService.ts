// FILE: /backend/src/services/brochureService.ts
//
// Brochure business logic: create from a theme or a saved template, edit, render to
// PDF, send on WhatsApp, and save a finished design back as a reusable template.

const {
  Brochure, BrochureTemplate, BrochureAsset, Property, Package, Lead, Customer, Agency,
} = require('../models');
const brochureDoc = require('./brochureDoc');
const brochureThemes = require('./brochureThemes');
const brochurePdfService = require('./brochurePdfService');
const documentDeliveryService = require('./documentDeliveryService');
const mediaService = require('./mediaService');

function fail(message, statusCode, code) {
  return Object.assign(new Error(message), { statusCode, code });
}

const { countSlots } = brochureDoc;

// --- assets ----------------------------------------------------------------

async function listAssets(agencyId, brochureId) {
  return BrochureAsset.findAll({
    where: { agencyId, ...(brochureId ? { brochureId } : {}) },
    order: [['sortOrder', 'ASC'], ['createdAt', 'ASC']],
  });
}

/**
 * Persist a batch of uploaded photos. Uploads run concurrently — a 30-photo batch
 * serialized would take minutes.
 */
async function addAssets(agencyId, brochureId, files) {
  if (!files || !files.length) throw fail('No images uploaded', 400, 'NO_IMAGES');

  const existing = await BrochureAsset.count({ where: { agencyId, ...(brochureId ? { brochureId } : {}) } });

  const uploaded = await Promise.all(
    files.map((file) => mediaService.uploadBrochureImage(file.buffer, agencyId))
  );

  const rows = uploaded.map((result, i) => ({
    agencyId,
    brochureId: brochureId || null,
    url: result.secureUrl,
    publicId: result.publicId,
    filename: files[i]?.originalname || null,
    sortOrder: existing + i,
  }));

  return BrochureAsset.bulkCreate(rows);
}

async function reorderAssets(agencyId, orderedIds) {
  await Promise.all(
    orderedIds.map((id, i) => BrochureAsset.update({ sortOrder: i }, { where: { id, agencyId } }))
  );
  return true;
}

async function deleteAsset(agencyId, id) {
  const deleted = await BrochureAsset.destroy({ where: { id, agencyId } });
  if (!deleted) throw fail('Image not found', 404, 'ASSET_NOT_FOUND');
  return true;
}

// --- merge fields ----------------------------------------------------------

/** Seed merge fields from a linked Property/Package, so the deck arrives pre-filled. */
async function fieldsFromSource(agencyId, { propertyId, packageId }) {
  const agency = await Agency.findByPk(agencyId);
  const fields = {
    agency_name: agency?.name || '',
    contact_phone: agency?.phone || '',
    contact_email: agency?.email || '',
    website: agency?.website || '',
  };

  if (propertyId) {
    const property = await Property.findOne({ where: { id: propertyId, agencyId } });
    if (property) {
      fields.property_name = property.name || '';
      fields.location = property.location || property.city || '';
      fields.about = property.description || '';
      if (property.price != null) fields.price = `From ₹${property.price}`;
    }
  } else if (packageId) {
    const pkg = await Package.findOne({ where: { id: packageId, agencyId } });
    if (pkg) {
      fields.property_name = pkg.name || '';
      fields.location = pkg.destination || '';
      fields.about = pkg.description || '';
      if (pkg.price != null) fields.price = `From ₹${pkg.price}`;
    }
  }

  return fields;
}

/** Photos already attached to a linked Property, so the agency need not re-upload. */
async function imagesFromSource(agencyId, { propertyId }) {
  if (!propertyId) return [];
  const property = await Property.findOne({ where: { id: propertyId, agencyId } });
  if (!property) return [];
  const images = Array.isArray(property.images) ? property.images : [];
  const urls = images.map((i) => (typeof i === 'string' ? i : i?.url)).filter(Boolean);
  if (!urls.length && property.imageUrl) urls.push(property.imageUrl);
  return urls.map((url) => ({ url }));
}

// --- brochures -------------------------------------------------------------

async function list(agencyId) {
  return Brochure.findAll({
    where: { agencyId },
    order: [['updatedAt', 'DESC']],
    attributes: ['id', 'title', 'status', 'propertyId', 'packageId', 'pdfUrl', 'renderedAt', 'updatedAt'],
  });
}

async function getById(agencyId, id) {
  const brochure = await Brochure.findOne({ where: { id, agencyId } });
  if (!brochure) throw fail('Brochure not found', 404, 'BROCHURE_NOT_FOUND');
  return brochure;
}

/**
 * Create a brochure from either a saved template or a built-in theme.
 *
 * The photo list is the agency's tray (assets) plus anything already on the linked
 * property. Slots fill in tray order, so the order the agency arranges photos in is
 * the order they appear in the deck.
 */
async function create(agencyId, payload = {}) {
  const {
    title, templateId, preset = 'luxury-editorial', size = null,
    propertyId = null, packageId = null, assetIds = null, blank = false,
  } = payload;

  if (!title || !String(title).trim()) throw fail('Title is required', 400, 'TITLE_REQUIRED');

  const { images, fields } = await gatherSources(agencyId, { propertyId, packageId, assetIds });

  let baseDoc;
  if (blank) {
    baseDoc = brochureThemes.blankDeck(size || 'portrait');
  } else if (templateId) {
    const template = await BrochureTemplate.findOne({
      where: { id: templateId, agencyId: [agencyId, null] },
    });
    if (!template) throw fail('Template not found', 404, 'TEMPLATE_NOT_FOUND');
    baseDoc = template.doc;
  } else {
    baseDoc = brochureThemes.buildDeck(preset, images.length || 1, size);
  }

  const doc = brochureDoc.fillDoc(baseDoc, images, fields);

  return Brochure.create({
    agencyId,
    title: String(title).trim(),
    status: 'DRAFT',
    propertyId,
    packageId,
    doc,
    fields,
  });
}

/** The photo pool (tray + any linked property's images) and the seeded merge fields. */
async function gatherSources(agencyId, { propertyId, packageId, assetIds } = {}) {
  const assets = await listAssets(agencyId, null);
  const selected = Array.isArray(assetIds) && assetIds.length
    ? assetIds.map((id) => assets.find((a) => a.id === id)).filter(Boolean)
    : assets;

  const sourceImages = await imagesFromSource(agencyId, { propertyId });
  const images = [...selected.map((a) => ({ url: a.url })), ...sourceImages];
  const fields = await fieldsFromSource(agencyId, { propertyId, packageId });

  return { images, fields };
}

/**
 * Build every shipped design against the agency's OWN photos, so the picker can show
 * ten live previews of this resort rather than ten generic swatches. Only the opening
 * pages are returned — a full ten-deck payload would be megabytes, and the picker only
 * ever renders the first spread.
 */
const PREVIEW_PAGES = 3;

async function previewPresets(agencyId, { propertyId = null, packageId = null } = {}) {
  const { images, fields } = await gatherSources(agencyId, { propertyId, packageId });
  const count = images.length || 6;

  return brochureThemes.listPresets().map((preset) => {
    const deck = brochureThemes.buildDeck(preset.key, count);
    const filled = brochureDoc.fillDoc(deck, images, fields);

    return {
      ...preset,
      pages: filled.pages.length,
      slots: brochureDoc.countSlots(deck),
      doc: { ...filled, pages: filled.pages.slice(0, PREVIEW_PAGES) },
    };
  });
}

async function update(agencyId, id, payload = {}) {
  const brochure = await getById(agencyId, id);

  const patch = {};
  if (payload.title != null) patch.title = String(payload.title).trim();
  if (payload.status === 'DRAFT' || payload.status === 'READY') patch.status = payload.status;
  if (payload.fields && typeof payload.fields === 'object') {
    patch.fields = { ...(brochure.fields || {}), ...payload.fields };
  }
  if (payload.doc) {
    // Normalize on the way in: the doc is the one thing a compromised client could
    // use to smuggle arbitrary markup into a server-rendered page.
    patch.doc = brochureDoc.normalizeDoc(payload.doc);
    // Merge fields edited in the form must win over stale text baked into elements.
    if (patch.fields || brochure.fields) {
      patch.doc = brochureDoc.fillDoc(patch.doc, [], patch.fields || brochure.fields);
    }
  }

  await brochure.update(patch);
  return brochure;
}

/** Recolour / re-typeset the whole deck from a palette change. */
async function retheme(agencyId, id, palette = {}) {
  const brochure = await getById(agencyId, id);
  const doc = brochureDoc.retheme(brochure.doc, palette);
  await brochure.update({ doc });
  return brochure;
}

/**
 * Change the page shape by REBUILDING the deck at the new size.
 *
 * The layout kit is responsive: `buildDeck` derives tile and row sizes from the content
 * box, so a preset laid out for A4 landscape is a different set of coordinates from the
 * same preset on portrait. Simply writing new pageW/pageH would strand every element at
 * its old coordinates — off the right edge of a narrower page — which is why this rebuilds
 * rather than patching the page box.
 *
 * The palette and the merge fields survive (they are re-applied to the fresh deck); the
 * per-element edits do not, because the elements themselves are regenerated. The caller
 * is expected to have confirmed that with the user first.
 */
async function resize(agencyId, id, size) {
  if (!brochureDoc.PAGE_SIZES[size] || size === 'custom') {
    throw fail('Pick A4 portrait, A4 landscape or square', 400, 'INVALID_SIZE');
  }

  const brochure = await getById(agencyId, id);
  const current = brochureDoc.normalizeDoc(brochure.doc);

  const presetKey = brochureThemes.resolvePresetKey(current);
  if (!presetKey) {
    // Deliberately refuse rather than guess: rebuilding with the wrong preset would
    // silently turn a photo book into an editorial and destroy the design.
    throw fail(
      'This brochure predates size-rebuild, so its design cannot be identified. Create a new brochure at the size you want.',
      400,
      'PRESET_UNKNOWN',
    );
  }

  const { images } = await gatherSources(agencyId, {
    propertyId: brochure.propertyId,
    packageId: brochure.packageId,
  });
  const fields = brochure.fields || {};

  const rebuilt = brochureThemes.buildDeck(presetKey, images.length || 1, size);
  // Carry the deck's CURRENT palette onto the fresh one, so a recoloured brochure does
  // not snap back to the preset's stock colours just because it was resized.
  const themed = brochureDoc.retheme(rebuilt, current.theme || {});
  const doc = brochureDoc.fillDoc(themed, images, fields);

  await brochure.update({ doc });
  return brochure;
}

async function remove(agencyId, id) {
  const deleted = await Brochure.destroy({ where: { id, agencyId } });
  if (!deleted) throw fail('Brochure not found', 404, 'BROCHURE_NOT_FOUND');
  return true;
}

/** Re-apply a template to an existing brochure, refilling slots from its photos. */
async function applyTemplate(agencyId, id, templateId) {
  const brochure = await getById(agencyId, id);
  const template = await BrochureTemplate.findOne({
    where: { id: templateId, agencyId: [agencyId, null] },
  });
  if (!template) throw fail('Template not found', 404, 'TEMPLATE_NOT_FOUND');

  const assets = await listAssets(agencyId, null);
  const images = assets.map((a) => ({ url: a.url }));
  const doc = brochureDoc.fillDoc(template.doc, images, brochure.fields || {});

  await brochure.update({ doc });
  return brochure;
}

// --- render / deliver ------------------------------------------------------

/** Render to PDF, store it as a public asset, and remember the URL. */
async function render(agencyId, id) {
  const brochure = await getById(agencyId, id);

  const buffer = await brochurePdfService.renderPdf(brochure.doc);
  const filename = brochurePdfService.filenameFor(brochure.title);
  const uploaded = await mediaService.uploadDocumentPdf(buffer, agencyId, 'brochure', brochure.id);

  await brochure.update({ pdfUrl: uploaded.secureUrl, renderedAt: new Date(), status: 'READY' });

  return { buffer, filename, url: uploaded.secureUrl, brochure };
}

/** Render (if needed) and send the brochure to a lead as a WhatsApp document. */
async function sendToLead(agency, id, leadId, { agentId } = {}) {
  const agencyId = agency.id || agency.get?.('id');
  const lead = await Lead.findOne({
    where: { id: leadId, agencyId },
    include: [{ model: Customer, as: 'customer' }],
  });
  if (!lead) throw fail('Lead not found', 404, 'LEAD_NOT_FOUND');

  const phone = lead.customer?.phone;
  if (!phone) throw fail('This lead has no WhatsApp number', 400, 'NO_RECIPIENT_PHONE');

  const { url, filename } = await render(agencyId, id);

  return documentDeliveryService.sendUploadedDocument({
    docType: 'brochure',
    agency,
    recipient: { phone, name: lead.customer?.name || '', customerId: lead.customerId },
    agentId,
    url,
    filename,
  });
}

// --- templates -------------------------------------------------------------

/** Agency's own saved designs plus the platform-shipped presets. */
async function listTemplates(agencyId) {
  return BrochureTemplate.findAll({
    where: { agencyId: [agencyId, null] },
    order: [['agencyId', 'ASC'], ['createdAt', 'DESC']],
  });
}

/**
 * Save a finished brochure back as a reusable design.
 *
 * The photos are stripped (toTemplateDoc empties every slotted image) but the layout,
 * type, colours and decoration survive. Next resort: pick this template, drop 30 new
 * photos, and the slots refill in order.
 */
async function saveAsTemplate(agencyId, id, name) {
  const brochure = await getById(agencyId, id);
  if (!name || !String(name).trim()) throw fail('Template name is required', 400, 'NAME_REQUIRED');

  const doc = brochureDoc.toTemplateDoc(brochure.doc);

  return BrochureTemplate.create({
    agencyId,
    name: String(name).trim(),
    doc,
    slotCount: countSlots(doc),
    thumbnailUrl: null,
  });
}

async function deleteTemplate(agencyId, id) {
  // agencyId in the where clause keeps an agency from deleting a platform preset.
  const deleted = await BrochureTemplate.destroy({ where: { id, agencyId } });
  if (!deleted) throw fail('Template not found', 404, 'TEMPLATE_NOT_FOUND');
  return true;
}

module.exports = {
  countSlots,
  listAssets,
  addAssets,
  reorderAssets,
  deleteAsset,
  previewPresets,
  list,
  getById,
  create,
  update,
  retheme,
  resize,
  remove,
  applyTemplate,
  render,
  sendToLead,
  listTemplates,
  saveAsTemplate,
  deleteTemplate,
};
