// FILE: /backend/src/services/leadFormService.ts
// DEPS: sequelize
//
// Named, agency-owned public lead forms. An agency can have many (e.g. "Villa
// enquiry", "Package enquiry"), each with its own slug + fields, served at
// /lead/:agencyKey/:slug. Exactly one is isDefault and answers the bare
// /lead/:agencyKey, so pre-existing Instagram-bio links keep working.
//
// Field sanitising is delegated to leadFormConfig.normalizeLeadFormConfig so the
// public renderer/validator stays the single source of truth for field shape.

const { Op } = require('sequelize');
const { LeadForm, Agency } = require('../models');
const leadFormConfig = require('./leadFormConfig');

const MAX_FORMS_PER_AGENCY = 50;

function httpError(message, statusCode, code) {
  return Object.assign(new Error(message), { statusCode, code });
}

function slugify(value, fallback = 'form') {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return slug || fallback;
}

/** Appends -2, -3 … until the slug is free for this agency. */
async function uniqueSlug(agencyId, base, excludeId = null) {
  const root = slugify(base);
  let candidate = root;
  for (let n = 2; ; n += 1) {
    const where = { agencyId, slug: candidate };
    if (excludeId) where.id = { [Op.ne]: excludeId };
    const clash = await LeadForm.findOne({ where, attributes: ['id'] });
    if (!clash) return candidate;
    candidate = `${root}-${n}`.slice(0, 80);
  }
}

/** Shapes a LeadForm row into the config object leadFormConfig.* understands. */
function toConfig(form) {
  if (!form) return null;
  return {
    id: form.id,
    name: form.name,
    slug: form.slug,
    enabled: Boolean(form.enabled),
    title: form.title || '',
    description: form.description || '',
    successMessage: form.successMessage || '',
    submitLabel: form.submitLabel || '',
    fields: Array.isArray(form.fields) ? form.fields : [],
  };
}

async function clearOtherDefaults(agencyId, keepId) {
  await LeadForm.update(
    { isDefault: false },
    { where: { agencyId, id: { [Op.ne]: keepId } } },
  );
}

/**
 * Guarantees the agency has at least one form. On first access we migrate the
 * agency's legacy single `leadFormConfig` into a real row (slug "enquiry",
 * isDefault) — no separate migration script needed, and old links keep resolving.
 */
async function ensureDefaultForm(agency) {
  const existing = await LeadForm.findOne({
    where: { agencyId: agency.id },
    order: [['isDefault', 'DESC'], ['createdAt', 'ASC']],
  });
  if (existing) return existing;

  const legacy = leadFormConfig.normalizeLeadFormConfig(leadFormConfig.resolveConfig(agency));
  return LeadForm.create({
    agencyId: agency.id,
    name: 'Enquiry',
    slug: 'enquiry',
    enabled: Boolean(legacy.enabled),
    isDefault: true,
    title: legacy.title,
    description: legacy.description,
    successMessage: legacy.successMessage,
    submitLabel: legacy.submitLabel,
    fields: legacy.fields,
    displayOrder: 0,
  });
}

async function listForms(agencyId) {
  const agency = await Agency.findByPk(agencyId);
  if (!agency) throw httpError('Agency not found', 404, 'NOT_FOUND');
  await ensureDefaultForm(agency);
  return LeadForm.findAll({
    where: { agencyId },
    order: [['isDefault', 'DESC'], ['displayOrder', 'ASC'], ['createdAt', 'ASC']],
  });
}

async function getForm(agencyId, id) {
  const form = await LeadForm.findOne({ where: { id, agencyId } });
  if (!form) throw httpError('Lead form not found', 404, 'LEAD_FORM_NOT_FOUND');
  return form;
}

function copyFrom(normalized, input) {
  return {
    enabled: Boolean(normalized.enabled),
    title: normalized.title,
    description: normalized.description,
    successMessage: normalized.successMessage,
    submitLabel: normalized.submitLabel,
    fields: normalized.fields,
    displayOrder: Number.isFinite(Number(input?.displayOrder)) ? Number(input.displayOrder) : 0,
  };
}

async function createForm(agencyId, input = {}) {
  const count = await LeadForm.count({ where: { agencyId } });
  if (count >= MAX_FORMS_PER_AGENCY) {
    throw httpError(`A maximum of ${MAX_FORMS_PER_AGENCY} lead forms is allowed`, 400, 'LEAD_FORM_LIMIT');
  }

  const name = String(input.name || '').trim().slice(0, 120) || 'Untitled form';
  const slug = await uniqueSlug(agencyId, input.slug || name);
  const normalized = leadFormConfig.normalizeLeadFormConfig(input);
  // The very first form is always the default, so the bare /lead/:agencyKey resolves.
  const isDefault = count === 0 ? true : Boolean(input.isDefault);

  const form = await LeadForm.create({
    agencyId,
    name,
    slug,
    isDefault,
    ...copyFrom(normalized, input),
  });
  if (isDefault) await clearOtherDefaults(agencyId, form.id);
  return form;
}

async function updateForm(agencyId, id, input = {}) {
  const form = await getForm(agencyId, id);
  const normalized = leadFormConfig.normalizeLeadFormConfig(input);

  const name = String(input.name || form.name || '').trim().slice(0, 120) || form.name;
  const slugSource = input.slug !== undefined ? input.slug : null;
  const slug = slugSource === null
    ? form.slug
    : await uniqueSlug(agencyId, slugSource || name, form.id);

  // A form can only be promoted to default, never silently demoted — demoting
  // happens implicitly when another form is promoted.
  const isDefault = input.isDefault === undefined ? form.isDefault : Boolean(input.isDefault);

  await form.update({ name, slug, isDefault, ...copyFrom(normalized, input) });
  if (isDefault) await clearOtherDefaults(agencyId, form.id);
  return form;
}

async function deleteForm(agencyId, id) {
  const form = await getForm(agencyId, id);
  const wasDefault = form.isDefault;
  await form.destroy();

  // Never leave an agency without a default — promote the next form if any remain.
  if (wasDefault) {
    const next = await LeadForm.findOne({
      where: { agencyId },
      order: [['displayOrder', 'ASC'], ['createdAt', 'ASC']],
    });
    if (next) await next.update({ isDefault: true });
  }
  return { id };
}

/**
 * Public resolution: a slug picks that named form; no slug falls back to the
 * agency's default (seeded on the fly for agencies that never had one).
 */
async function resolvePublicForm(agency, slug) {
  const key = String(slug || '').trim().toLowerCase();
  if (!key) return ensureDefaultForm(agency);
  return LeadForm.findOne({ where: { agencyId: agency.id, slug: key } });
}

module.exports = {
  MAX_FORMS_PER_AGENCY,
  slugify,
  toConfig,
  ensureDefaultForm,
  listForms,
  getForm,
  createForm,
  updateForm,
  deleteForm,
  resolvePublicForm,
};
