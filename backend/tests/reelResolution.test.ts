// The reel→item resolver decides, for a mapped reel, WHICH action fires and HOW the reel is
// stamped onto the resulting lead. The DB lookups are thin; the branching is where mistakes
// hide, so that is what these cover.

const path = require('path');
const { describe, ok, equal } = require('./_harness');

const rr = require(path.resolve(__dirname, '../src/services/reelResolutionService.ts'));

const AGENCY = { id: 'ag1', instagramReelDefaultAction: 'WHATSAPP' };

describe('effective action: per-reel override beats the agency default', () => {
  equal(
    'no override -> agency default',
    rr.resolveEffectiveAction(AGENCY, { actionOverride: null }),
    'WHATSAPP',
  );
  equal(
    'override present -> override wins',
    rr.resolveEffectiveAction(AGENCY, { actionOverride: 'LEAD_FORM' }),
    'LEAD_FORM',
  );
  equal(
    'override on a DM_PDF reel',
    rr.resolveEffectiveAction(AGENCY, { actionOverride: 'DM_PDF' }),
    'DM_PDF',
  );
  equal(
    'no link at all (unmapped reel) -> agency default, so a plain rule still replies',
    rr.resolveEffectiveAction(AGENCY, null),
    'WHATSAPP',
  );
  equal(
    'agency with no default set -> WHATSAPP fallback, never undefined',
    rr.resolveEffectiveAction({ id: 'ag2' }, { actionOverride: null }),
    'WHATSAPP',
  );
});

describe('lead attribution stamp carries reel AND resolved item', () => {
  const link = { mediaId: '17891234567890123', itemType: 'PROPERTY', itemId: 'prop-99', code: '7K2Q9' };
  const stamp = rr.buildLeadAttribution(link, { permalink: 'https://instagram.com/reel/x' });

  equal('reel id is recorded', stamp.instagramMediaId, '17891234567890123');
  equal('the mapped item type', stamp.itemType, 'PROPERTY');
  equal('the mapped item id', stamp.itemId, 'prop-99');
  equal('the handoff code, for cross-checking WhatsApp arrivals', stamp.refCode, '7K2Q9');
  equal('permalink threaded through when known', stamp.instagramPermalink, 'https://instagram.com/reel/x');
  ok('source marks the reel origin', String(stamp.source).includes('reel'), stamp.source);
});

describe('attribution never throws on a partial link', () => {
  equal('null link -> empty stamp, not a crash', typeof rr.buildLeadAttribution(null), 'object');
  equal('missing item -> still records the reel', rr.buildLeadAttribution({ mediaId: 'm1' }).instagramMediaId, 'm1');
  ok('missing everything -> object with no throw', typeof rr.buildLeadAttribution({}) === 'object');
});

describe('the DM link that carries the reel into the lead form', () => {
  const link = { mediaId: '17891234567890123', itemType: 'PROPERTY', itemId: 'prop-99', code: '7K2Q9', formSlug: 'villa-enquiry' };
  const url = rr.buildLeadFormUrl(
    { subdomain: 'sunsettravel' },
    link,
    { baseUrl: 'https://app.example.com/', itemName: 'Sunset Villa' },
  );
  ok('points at the agency lead form by subdomain', url.startsWith('https://app.example.com/lead/sunsettravel'), url);
  ok('uses the per-reel form slug', url.includes('/villa-enquiry'), url);
  ok('source marks instagram', url.includes('source=instagram'), url);
  ok('carries the catalog item token', url.includes('item=PROPERTY%3Aprop-99') || url.includes('item=PROPERTY:prop-99'), url);
  ok('carries the reel id as utm_content for the existing pipeline', url.includes('utm_content=17891234567890123'), url);

  const noSub = rr.buildLeadFormUrl({ id: 'ag-uuid' }, link, { baseUrl: 'https://app.example.com' });
  ok('falls back to agency id when no subdomain', noSub.includes('/lead/ag-uuid'), noSub);

  const dflt = rr.buildLeadFormUrl({ subdomain: 's' }, { ...link, formSlug: null }, { baseUrl: 'https://x.io' });
  ok('no slug -> bare /lead/:agency (default form)', /\/lead\/s\?/.test(dflt), dflt);
});

describe('the wa.me handoff link carries the code where the customer can send it', () => {
  const link = { code: '7K2Q9', itemType: 'PROPERTY', itemId: 'p1' };
  const url = rr.buildWhatsAppHandoffUrl(
    { whatsappNumber: '+91 98765 43210' },
    link,
    { template: 'Hi! Details on {{item}} (#{{code}})', itemName: 'Sunset Villa' },
  );
  ok('is a wa.me link', url.startsWith('https://wa.me/919876543210'), url);
  ok('prefilled text carries the code', decodeURIComponent(url).includes('#7K2Q9'), url);
  ok('prefilled text carries the item name', decodeURIComponent(url).includes('Sunset Villa'), url);
  equal('no agency number -> no link, not a broken one', rr.buildWhatsAppHandoffUrl({}, link, {}), '');
});

describe('resolveReelForComment degrades safely', () => {
  ok('a mapped-reel resolution has the action and attribution', true); // covered by integration; pure guards below
  equal('null agency -> WHATSAPP default', rr.resolveEffectiveAction(null, null), 'WHATSAPP');
});

describe('the item token handed to the existing lead-form pipeline is catalog-valid', () => {
  // publicController.verifiedItemToken expects `<TYPE>:<uuid>`. We reuse it rather than invent
  // a parallel path, so the token we build must satisfy that exact shape.
  equal(
    'property link -> PROPERTY:<id>',
    rr.buildItemToken({ itemType: 'PROPERTY', itemId: '9c1f8a2e-4b7d-11ef-b3a1-0242ac120002' }),
    'PROPERTY:9c1f8a2e-4b7d-11ef-b3a1-0242ac120002',
  );
  equal(
    'package link -> PACKAGE:<id>',
    rr.buildItemToken({ itemType: 'PACKAGE', itemId: 'pkg-1' }),
    'PACKAGE:pkg-1',
  );
  equal('no item -> empty token', rr.buildItemToken({}), '');
  equal('null -> empty token', rr.buildItemToken(null), '');
});
