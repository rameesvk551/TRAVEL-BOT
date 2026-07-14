const { normalizePhone, isValidIndianPhone } = require('../utils/phoneUtils');

// Canonical field input types the public form builder supports.
const FIELD_TYPES = ['text', 'phone', 'email', 'date', 'number', 'select', 'textarea'];

// Where a configured field's answer is routed when a lead is created. Targets map
// either to native Lead columns or to keys the lead-details panel already renders
// (adults / children breakdown live inside customTripDetails). 'custom' answers are
// surfaced as a labelled flow-submission section in lead details.
const MAP_TARGETS = [
  'customerName',
  'customerPhone',
  'customerEmail',
  'destination',
  'travellers',
  'adults',
  'children6To12',
  'childrenBelow5',
  'travelStart',
  'travelEnd',
  'travelDates',
  'budgetPerPerson',
  'interest',
  'notes',
  'custom',
];

// Numeric pax fields that roll up into lead.travellers when no explicit total is given.
const PAX_FIELDS = ['adults', 'children6To12', 'childrenBelow5'];

const DEFAULT_FIELDS = [
  { id: 'name', label: 'Full name', type: 'text', placeholder: 'Your name', required: true, mapsTo: 'customerName' },
  { id: 'phone', label: 'WhatsApp number', type: 'phone', placeholder: '+91 9XXXXXXXXX', required: true, mapsTo: 'customerPhone' },
  { id: 'destination', label: 'Where do you want to go?', type: 'text', placeholder: 'e.g. Bali, Dubai, Kashmir', required: false, mapsTo: 'destination' },
  { id: 'travelDates', label: 'Travel dates', type: 'text', placeholder: 'e.g. 12-18 Dec', required: false, mapsTo: 'travelDates' },
  { id: 'adults', label: 'Adults', type: 'number', placeholder: '2', required: false, mapsTo: 'adults' },
  { id: 'children6To12', label: 'Children (6-12 yrs)', type: 'number', placeholder: '0', required: false, mapsTo: 'children6To12' },
  { id: 'childrenBelow5', label: 'Children (below 5 yrs)', type: 'number', placeholder: '0', required: false, mapsTo: 'childrenBelow5' },
  { id: 'budgetPerPerson', label: 'Budget per person (₹)', type: 'number', placeholder: '50000', required: false, mapsTo: 'budgetPerPerson' },
  { id: 'notes', label: 'Anything else we should know?', type: 'textarea', placeholder: 'Tell us about your trip', required: false, mapsTo: 'notes' },
];

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Maps a catalog item type to the Lead foreign-key column it populates. Lets a
// lead-form submission carry a specific catalog item (e.g. the property a customer
// tapped "Check availability" on) via an `item` token like "PROPERTY:<uuid>".
const ITEM_FK = {
  PACKAGE: 'packageId',
  PROPERTY: 'propertyId',
  SERVICE: 'serviceId',
  VISA: 'visaId',
  CRUISE: 'cruiseId',
};

/**
 * Parses an `item` token of the form "TYPE:<uuid>" (e.g. "PROPERTY:8f3c…") into
 * { itemType, itemId }. Returns null unless the type is a known catalog type and
 * the id is a valid UUID (guards the Lead UUID FK columns from a cast error).
 */
function parseItemToken(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;
  const sep = value.indexOf(':');
  if (sep < 0) return null;
  const itemType = value.slice(0, sep).trim().toUpperCase();
  const itemId = value.slice(sep + 1).trim();
  if (!ITEM_FK[itemType] || !UUID_RE.test(itemId)) return null;
  return { itemType, itemId };
}

function slugify(value, fallback) {
  const slug = String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return slug || fallback;
}

function defaultLeadFormConfig() {
  return {
    enabled: false,
    title: 'Plan your trip with us',
    description: 'Tell us a few details and our travel expert will reach out on WhatsApp.',
    successMessage: 'Thank you! Our travel expert will contact you shortly.',
    submitLabel: 'Send my enquiry',
    fields: DEFAULT_FIELDS.map((f) => ({ ...f })),
  };
}

function normalizeOptions(rawOptions) {
  if (!Array.isArray(rawOptions)) return [];
  const seen = new Set();
  const options = [];
  for (const opt of rawOptions) {
    const label = String((opt && (opt.label ?? opt.value)) || '').trim().slice(0, 120);
    if (!label) continue;
    const value = String((opt && (opt.value ?? opt.label)) || label).trim().slice(0, 120);
    if (seen.has(value)) continue;
    seen.add(value);
    options.push({ label, value });
    if (options.length >= 50) break;
  }
  return options;
}

/**
 * Sanitises an incoming lead-form config before it is persisted. Guarantees stable,
 * unique field ids, valid types/targets, and — when the form is enabled — that a
 * required phone field and a name field exist so every submission yields a usable lead.
 */
function normalizeLeadFormConfig(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return {};
  }

  const enabled = Boolean(input.enabled);
  const usedIds = new Set();
  const rawFields = Array.isArray(input.fields) ? input.fields.slice(0, 40) : [];

  const fields = [];
  rawFields.forEach((raw, index) => {
    if (!raw || typeof raw !== 'object') return;
    const label = String(raw.label || '').trim().slice(0, 120);
    if (!label) return;

    const type = FIELD_TYPES.includes(raw.type) ? raw.type : 'text';
    let mapsTo = MAP_TARGETS.includes(raw.mapsTo) ? raw.mapsTo : 'custom';
    // Pax / numeric / date targets only make sense for matching input types.
    if (PAX_FIELDS.includes(mapsTo) || mapsTo === 'travellers' || mapsTo === 'budgetPerPerson') {
      if (type !== 'number') mapsTo = 'custom';
    }

    let id = slugify(raw.id || raw.label, `field_${index + 1}`);
    while (usedIds.has(id)) id = `${id}_${index + 1}`;
    usedIds.add(id);

    const field = {
      id,
      label,
      type,
      placeholder: String(raw.placeholder || '').trim().slice(0, 160),
      required: Boolean(raw.required),
      mapsTo,
    };
    if (type === 'select') field.options = normalizeOptions(raw.options);
    fields.push(field);
  });

  if (enabled) {
    // A phone-mapped, required field is mandatory — every lead needs a contact number.
    const phoneField = fields.find((f) => f.mapsTo === 'customerPhone');
    if (!phoneField) {
      fields.unshift({ ...DEFAULT_FIELDS[1] });
    } else {
      phoneField.required = true;
      if (phoneField.type !== 'phone') phoneField.type = 'phone';
    }
    if (!fields.some((f) => f.mapsTo === 'customerName')) {
      fields.unshift({ ...DEFAULT_FIELDS[0] });
    }
  }

  return {
    enabled,
    title: String(input.title || '').trim().slice(0, 160) || defaultLeadFormConfig().title,
    description: String(input.description || '').trim().slice(0, 600),
    successMessage: String(input.successMessage || '').trim().slice(0, 400) || defaultLeadFormConfig().successMessage,
    submitLabel: String(input.submitLabel || '').trim().slice(0, 60) || defaultLeadFormConfig().submitLabel,
    fields,
  };
}

// `formConfig` (a LeadForm record's config) wins when supplied; otherwise fall back
// to the agency's legacy single leadFormConfig, then the built-in default.
function resolveConfig(agency, formConfig) {
  if (formConfig && typeof formConfig === 'object' && Array.isArray(formConfig.fields) && formConfig.fields.length) {
    return formConfig;
  }
  const stored = agency && agency.leadFormConfig;
  if (stored && typeof stored === 'object' && Array.isArray(stored.fields) && stored.fields.length) {
    return stored;
  }
  return defaultLeadFormConfig();
}

/**
 * Sanitised, branding-rich payload safe to expose on the public form page. Field
 * `mapsTo` is intentionally omitted — the client only needs render metadata.
 */
function publicLeadFormPayload(agency, formConfig) {
  const config = resolveConfig(agency, formConfig);
  return {
    agencyName: agency.websiteTitle || agency.name,
    slug: formConfig?.slug || null,
    formName: formConfig?.name || null,
    enabled: Boolean(config.enabled),
    title: config.title || defaultLeadFormConfig().title,
    description: config.description || '',
    successMessage: config.successMessage || defaultLeadFormConfig().successMessage,
    submitLabel: config.submitLabel || defaultLeadFormConfig().submitLabel,
    branding: {
      logoUrl: agency.websiteLogoUrl || agency.companyLogoUrl || '',
      heroImageUrl: agency.websiteHeroImageUrl || '',
      primaryColor: agency.websitePrimaryColor || '#00A884',
    },
    fields: (config.fields || []).map((f) => ({
      id: f.id,
      label: f.label,
      type: f.type,
      placeholder: f.placeholder || '',
      required: Boolean(f.required),
      options: f.type === 'select' ? (f.options || []) : undefined,
    })),
  };
}

function readAnswer(body, fieldId) {
  const answers = body && typeof body.answers === 'object' && body.answers ? body.answers : {};
  const raw = answers[fieldId] !== undefined ? answers[fieldId] : (body ? body[fieldId] : undefined);
  return raw === undefined || raw === null ? '' : String(raw).trim();
}

function validationError(message) {
  return Object.assign(new Error(message), { statusCode: 400, code: 'LEAD_FORM_VALIDATION' });
}

/**
 * Validates a public submission against the agency's saved field config and maps the
 * answers onto a createLead() input. Throws a 400 on any required/format violation.
 * Returns { leadInput, hadContent }.
 */
function mapSubmissionToLead(agency, body, meta = {}, formConfig) {
  const config = resolveConfig(agency, formConfig);
  if (!config.enabled) {
    throw Object.assign(new Error('Lead form is not enabled'), { statusCode: 404, code: 'LEAD_FORM_DISABLED' });
  }

  const mapped = {};           // mapsTo -> value (last wins, except names which concat)
  const names = [];
  const paxCounts = {};
  const customAnswers = {};    // label -> value for flow-submission display
  let hadContent = false;

  for (const field of config.fields) {
    const value = readAnswer(body, field.id);

    if (!value) {
      if (field.required) throw validationError(`${field.label} is required`);
      continue;
    }
    hadContent = true;

    // Per-type validation.
    if (field.type === 'email' && !EMAIL_RE.test(value)) {
      throw validationError(`${field.label} must be a valid email`);
    }
    if (field.type === 'number' && !Number.isFinite(Number(value))) {
      throw validationError(`${field.label} must be a number`);
    }
    if (field.type === 'date' && Number.isNaN(new Date(value).getTime())) {
      throw validationError(`${field.label} must be a valid date`);
    }
    if (field.type === 'select') {
      const allowed = (field.options || []).map((o) => o.value);
      if (allowed.length && !allowed.includes(value)) {
        throw validationError(`${field.label} has an invalid selection`);
      }
    }
    if (field.type === 'phone' || field.mapsTo === 'customerPhone') {
      const digits = value.replace(/\D/g, '');
      if (digits.length < 8) throw validationError(`${field.label} must be a valid phone number`);
    }

    switch (field.mapsTo) {
      case 'customerName':
        names.push(value);
        break;
      case 'adults':
      case 'children6To12':
      case 'childrenBelow5': {
        const n = Math.max(0, Math.trunc(Number(value)));
        if (Number.isFinite(n)) paxCounts[field.mapsTo] = n;
        break;
      }
      case 'travellers': {
        const n = Math.max(0, Math.trunc(Number(value)));
        if (Number.isFinite(n) && n > 0) mapped.travellers = n;
        break;
      }
      case 'budgetPerPerson': {
        const rupees = Math.max(0, Math.trunc(Number(value)));
        if (Number.isFinite(rupees)) mapped.budgetPerPerson = rupees * 100; // store paise
        break;
      }
      case 'custom':
        customAnswers[field.label] = value;
        break;
      default:
        mapped[field.mapsTo] = value;
    }
  }

  const customerPhone = mapped.customerPhone;
  if (!customerPhone) throw validationError('A phone number is required');
  const customerName = names.join(' ').trim() || mapped.customerName || '';

  // Roll the pax breakdown up into the travellers total when no explicit total field exists.
  const paxTotal = PAX_FIELDS.reduce((sum, key) => sum + (paxCounts[key] || 0), 0);
  const travellers = mapped.travellers || (paxTotal > 0 ? paxTotal : undefined);

  const source = meta.source || meta.utm_source || 'lead_form';
  const submittedAt = meta.submittedAt || new Date().toISOString();

  const utm = {};
  ['source', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach((key) => {
    if (meta[key]) utm[key] = String(meta[key]).slice(0, 200);
  });

  const flowAnswers = { ...customAnswers };
  // Mirror the headline answers into the flow-submission so a glance at lead
  // details shows the full enquiry even for unmapped extras.
  if (mapped.destination) flowAnswers['Destination'] = mapped.destination;
  if (mapped.travelDates) flowAnswers['Travel dates'] = mapped.travelDates;
  if (travellers) flowAnswers['Travellers'] = String(travellers);

  const customTripDetails = {
    source,
    submittedAt,
    destination: mapped.destination,
    travelDate: mapped.travelDates,
    notes: mapped.notes,
    budgetPerPerson: mapped.budgetPerPerson,
    metaFields: Object.keys(utm).length ? utm : undefined,
    flowSubmissions: [
      {
        title: `Lead Form${source ? ` (${source})` : ''}`,
        answers: flowAnswers,
        submittedAt,
      },
    ],
  };
  PAX_FIELDS.forEach((key) => {
    if (paxCounts[key] !== undefined) customTripDetails[key] = paxCounts[key];
  });

  const tags = ['lead_form'];
  if (source && source !== 'lead_form') tags.push(source);

  const leadInput = {
    customerName: customerName || undefined,
    customerPhone,
    customerEmail: mapped.customerEmail || undefined,
    customerSource: source,
    destination: mapped.destination,
    travelDates: mapped.travelDates,
    travelStart: mapped.travelStart || undefined,
    travelEnd: mapped.travelEnd || undefined,
    travellers,
    budgetPerPerson: mapped.budgetPerPerson,
    interest: mapped.interest,
    notes: mapped.notes || `Lead form enquiry${source ? ` from ${source}` : ''}`,
    status: 'ENQUIRY',
    source,
    tags,
    itemType: 'CUSTOM_TRIP',
    customTripDetails,
  };

  // The customer arrived from a specific catalog item (e.g. tapped "Check
  // availability" on one property card) — carry it onto the lead so the FK, the
  // selected-items list and the item type all point at that record instead of a
  // generic custom trip. `item` is validated: unknown type / non-UUID id is ignored.
  const item = parseItemToken(meta.item !== undefined ? meta.item : body?.item);
  if (item) {
    leadInput[ITEM_FK[item.itemType]] = item.itemId;
    leadInput.itemType = item.itemType;
    leadInput.selectedItems = [{ itemType: item.itemType, itemId: item.itemId }];
    customTripDetails.selectedItemType = item.itemType;
    customTripDetails.selectedItemId = item.itemId;
  }

  return { leadInput, hadContent };
}

module.exports = {
  FIELD_TYPES,
  MAP_TARGETS,
  PAX_FIELDS,
  DEFAULT_FIELDS,
  ITEM_FK,
  defaultLeadFormConfig,
  normalizeLeadFormConfig,
  publicLeadFormPayload,
  mapSubmissionToLead,
  parseItemToken,
  resolveConfig,
};
