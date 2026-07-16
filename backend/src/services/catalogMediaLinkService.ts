// CRUD for reel→catalog-item mappings. See models/CatalogMediaLink.ts for the shape and
// reelResolutionService for how these rows are consumed at comment/DM time.

const { CatalogMediaLink } = require('../models');
const reelRefCode = require('../utils/reelRefCode');

const ITEM_TYPES = new Set(['PACKAGE', 'PROPERTY', 'SERVICE', 'VISA', 'CRUISE']);
const ACTIONS = new Set(['LEAD_FORM', 'WHATSAPP', 'DM_PDF']);

// Pure — validated and unit-tested without a DB. Throws a 400-tagged error on bad input so the
// controller's next(err) surfaces a clean message.
function normalizeLinkInput(payload: any = {}) {
  const mediaId = String(payload.mediaId || '').trim();
  const itemType = String(payload.itemType || '').trim().toUpperCase();
  const itemId = String(payload.itemId || '').trim();

  if (!mediaId) throw badRequest('mediaId is required', 'MEDIA_ID_REQUIRED');
  if (!ITEM_TYPES.has(itemType)) throw badRequest('itemType must be one of ' + [...ITEM_TYPES].join(', '), 'INVALID_ITEM_TYPE');
  if (!itemId) throw badRequest('itemId is required', 'ITEM_ID_REQUIRED');

  const out: any = { mediaId, itemType, itemId };

  const action = String(payload.actionOverride || '').trim().toUpperCase();
  out.actionOverride = action && ACTIONS.has(action) ? action : null;

  out.formSlug = payload.formSlug ? String(payload.formSlug).trim().slice(0, 255) : null;
  out.permalink = httpsUrlOrNull(payload.permalink);
  out.thumbnailUrl = httpsUrlOrNull(payload.thumbnailUrl);

  return out;
}

/**
 * Absolute https URL, or null.
 *
 * The permalink is rendered into an `<a href>` and the thumbnail into an `<img src>`, so a
 * `javascript:` URI stored here is a stored XSS that fires when staff click the reel. Both fields
 * are best-effort display metadata copied off the Graph API (which only ever returns https), so a
 * non-https value is dropped rather than 400'd — rejecting the whole mapping over cosmetic
 * metadata would be worse than losing the link text. Parsed with `URL` rather than a regex so
 * scheme tricks (`JaVaScRiPt:`, leading whitespace/control chars) can't slip past.
 */
function httpsUrlOrNull(value: any): string | null {
  if (!value) return null;
  const raw = String(value).trim().slice(0, 2000);
  try {
    return new URL(raw).protocol === 'https:' ? raw : null;
  } catch {
    return null;
  }
}

function badRequest(message: string, code: string) {
  return Object.assign(new Error(message), { statusCode: 400, code });
}

async function generateUniqueCode(agencyId: string): Promise<string> {
  // Codes are 5 chars from a 31-char alphabet (~28.6M combinations), so collisions are rare;
  // still, retry a few times before giving up rather than risk a unique-constraint 500.
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const code = reelRefCode.generateRefCode();
    const existing = await CatalogMediaLink.findOne({ where: { agencyId, code } });
    if (!existing) return code;
  }
  throw Object.assign(new Error('Could not allocate a unique handoff code'), { statusCode: 500, code: 'CODE_ALLOCATION_FAILED' });
}

async function listLinks(agencyId: string, filters: any = {}) {
  const where: any = { agencyId };
  if (filters.itemType) where.itemType = String(filters.itemType).toUpperCase();
  if (filters.itemId) where.itemId = filters.itemId;
  if (filters.mediaId) where.mediaId = filters.mediaId;
  return CatalogMediaLink.findAll({ where, order: [['createdAt', 'DESC']] });
}

// One reel maps to at most one item per agency (unique agency+media). Linking a reel that is
// already mapped re-points it to the new item rather than erroring — the agency simply moved
// the reel to a different property. The code is preserved so any DM already in the wild keeps
// resolving.
async function createLink(agencyId: string, payload: any) {
  const data = normalizeLinkInput(payload);

  const existing = await CatalogMediaLink.findOne({ where: { agencyId, mediaId: data.mediaId } });
  if (existing) {
    await existing.update({ ...data, isActive: true });
    return existing;
  }

  const code = await generateUniqueCode(agencyId);
  return CatalogMediaLink.create({ ...data, agencyId, code, isActive: true });
}

async function updateLink(agencyId: string, id: string, payload: any = {}) {
  const link = await CatalogMediaLink.findOne({ where: { id, agencyId } });
  if (!link) throw Object.assign(new Error('Link not found'), { statusCode: 404, code: 'LINK_NOT_FOUND' });

  const patch: any = {};
  if (payload.actionOverride !== undefined) {
    const a = String(payload.actionOverride || '').trim().toUpperCase();
    patch.actionOverride = a && ACTIONS.has(a) ? a : null;
  }
  if (payload.formSlug !== undefined) patch.formSlug = payload.formSlug ? String(payload.formSlug).trim().slice(0, 255) : null;
  if (payload.isActive !== undefined) patch.isActive = Boolean(payload.isActive);

  await link.update(patch);
  return link;
}

async function deleteLink(agencyId: string, id: string) {
  const link = await CatalogMediaLink.findOne({ where: { id, agencyId } });
  if (!link) throw Object.assign(new Error('Link not found'), { statusCode: 404, code: 'LINK_NOT_FOUND' });
  await link.destroy();
  return { id };
}

module.exports = {
  ITEM_TYPES,
  ACTIONS,
  normalizeLinkInput,
  generateUniqueCode,
  listLinks,
  createLink,
  updateLink,
  deleteLink,
};
