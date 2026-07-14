// FILE: /backend/src/controllers/leadFormController.ts
// Admin CRUD for an agency's named public lead forms. Every action is scoped to
// req.user.agencyId — a form is never reachable across agencies.

const leadFormService = require('../services/leadFormService');
const leadFormConfig = require('../services/leadFormConfig');

function formPayload(form) {
  return {
    id: form.id,
    name: form.name,
    slug: form.slug,
    enabled: Boolean(form.enabled),
    isDefault: Boolean(form.isDefault),
    title: form.title || '',
    description: form.description || '',
    successMessage: form.successMessage || '',
    submitLabel: form.submitLabel || '',
    fields: Array.isArray(form.fields) ? form.fields : [],
    displayOrder: form.displayOrder || 0,
    updatedAt: form.updatedAt,
  };
}

async function list(req, res, next) {
  try {
    const forms = await leadFormService.listForms(req.user.agencyId);
    res.json({
      success: true,
      data: forms.map(formPayload),
      meta: {
        fieldTypes: leadFormConfig.FIELD_TYPES,
        mapTargets: leadFormConfig.MAP_TARGETS,
      },
    });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const form = await leadFormService.getForm(req.user.agencyId, req.params.id);
    res.json({ success: true, data: formPayload(form) });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const form = await leadFormService.createForm(req.user.agencyId, req.body);
    res.status(201).json({ success: true, data: formPayload(form) });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const form = await leadFormService.updateForm(req.user.agencyId, req.params.id, req.body);
    res.json({ success: true, data: formPayload(form) });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await leadFormService.deleteForm(req.user.agencyId, req.params.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, update, remove };
