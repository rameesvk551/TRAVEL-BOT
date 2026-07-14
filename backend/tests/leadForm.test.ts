// The lead-capture path: a public form submission must land on a lead, and when the customer
// arrived from a specific catalog card ("Check Availability" on ONE property) the lead must be
// bound to THAT property rather than becoming a generic custom-trip enquiry.

const { describe, ok, equal } = require('./_harness');
const cfg = require('../src/services/leadFormConfig');

const PROP = '11111111-2222-3333-4444-555555555555';

const FORM = {
  name: 'Villa enquiry',
  slug: 'villa-enquiry',
  enabled: true,
  title: 'Enquire',
  successMessage: 'Thanks!',
  submitLabel: 'Send',
  fields: [
    { id: 'name', label: 'Full name', type: 'text', required: true, mapsTo: 'customerName' },
    { id: 'phone', label: 'WhatsApp number', type: 'phone', required: true, mapsTo: 'customerPhone' },
    { id: 'dates', label: 'Travel dates', type: 'text', required: false, mapsTo: 'travelDates' },
  ],
};
const AGENCY = { id: 'a1', name: 'Wayon Travels', leadFormConfig: null };
const BODY = { answers: { name: 'Asha', phone: '+91 9074823588', dates: '12-18 Dec' } };

describe('item token parsing is strict (it feeds a UUID foreign key)', () => {
  equal('valid PROPERTY token', cfg.parseItemToken(`PROPERTY:${PROP}`), { itemType: 'PROPERTY', itemId: PROP });
  equal('lowercase type normalised', cfg.parseItemToken(`property:${PROP}`)?.itemType, 'PROPERTY');
  equal('non-UUID id rejected (would 500 on the uuid column)', cfg.parseItemToken('PROPERTY:myagency'), null);
  equal('unknown type rejected', cfg.parseItemToken(`WIDGET:${PROP}`), null);
  equal('empty rejected', cfg.parseItemToken(''), null);
});

describe('a form submission maps onto a lead', () => {
  const { leadInput } = cfg.mapSubmissionToLead(AGENCY, BODY, { source: 'instagram' }, FORM);
  equal('name mapped', leadInput.customerName, 'Asha');
  ok('phone mapped', String(leadInput.customerPhone).includes('9074823588'));
  equal('travel dates mapped', leadInput.travelDates, '12-18 Dec');
  equal('source attributed', leadInput.source, 'instagram');
  ok('tagged for filtering', leadInput.tags.includes('lead_form') && leadInput.tags.includes('instagram'));
  equal('no item -> generic custom trip', leadInput.itemType, 'CUSTOM_TRIP');
  ok('no item -> no property linked', !leadInput.propertyId);
});

describe('arriving from a property card binds the lead to THAT property', () => {
  const { leadInput } = cfg.mapSubmissionToLead(AGENCY, BODY, { source: 'instagram', item: `PROPERTY:${PROP}` }, FORM);
  equal('propertyId set to the tapped property', leadInput.propertyId, PROP);
  equal('itemType is PROPERTY, not CUSTOM_TRIP', leadInput.itemType, 'PROPERTY');
  equal('selectedItems carries it', leadInput.selectedItems, [{ itemType: 'PROPERTY', itemId: PROP }]);
  equal('utm still captured', leadInput.customTripDetails.metaFields?.source, 'instagram');
});

describe('a PACKAGE card fills packageId, not propertyId', () => {
  const { leadInput } = cfg.mapSubmissionToLead(AGENCY, BODY, { item: `PACKAGE:${PROP}` }, FORM);
  equal('packageId set', leadInput.packageId, PROP);
  ok('propertyId untouched', !leadInput.propertyId);
  equal('itemType PACKAGE', leadInput.itemType, 'PACKAGE');
});

describe('bad input fails safely', () => {
  const { leadInput } = cfg.mapSubmissionToLead(AGENCY, BODY, { item: 'PROPERTY:not-a-uuid' }, FORM);
  equal('a bogus item is ignored, not fatal', leadInput.itemType, 'CUSTOM_TRIP');
  ok('no property linked', !leadInput.propertyId);

  try {
    cfg.mapSubmissionToLead(AGENCY, BODY, {}, { ...FORM, enabled: false });
    ok('a disabled form refuses submissions', false, 'it did not throw');
  } catch (err) {
    equal('a disabled form refuses submissions (404)', err.statusCode, 404);
  }

  try {
    cfg.mapSubmissionToLead(AGENCY, { answers: { name: 'Asha' } }, {}, FORM);
    ok('a missing required field is rejected', false, 'it did not throw');
  } catch (err) {
    equal('a missing required field is rejected (400)', err.statusCode, 400);
  }
});
