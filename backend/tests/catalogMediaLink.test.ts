// Input validation for the reel→item mapping CRUD. The DB paths need a live DB; this covers the
// pure normalizer, which is where a bad payload would otherwise reach the unique constraint and
// 500 instead of returning a clean 400.

const path = require('path');
const { describe, ok, equal } = require('./_harness');

const svc = require(path.resolve(__dirname, '../src/services/catalogMediaLinkService.ts'));

function reason(fn: () => any): string {
  try { fn(); return ''; } catch (e: any) { return e.code || e.message; }
}

describe('a valid mapping normalizes', () => {
  const out = svc.normalizeLinkInput({
    mediaId: '17891234567890123',
    itemType: 'property',
    itemId: 'prop-1',
    actionOverride: 'lead_form',
    formSlug: 'villa-enquiry',
    permalink: 'https://instagram.com/reel/x',
    thumbnailUrl: 'https://cdn/x.jpg',
  });
  equal('mediaId kept', out.mediaId, '17891234567890123');
  equal('itemType upper-cased', out.itemType, 'PROPERTY');
  equal('itemId kept', out.itemId, 'prop-1');
  equal('actionOverride upper-cased', out.actionOverride, 'LEAD_FORM');
  equal('formSlug kept', out.formSlug, 'villa-enquiry');
});

describe('bad input is a clean 400, never a DB error', () => {
  equal('no mediaId', reason(() => svc.normalizeLinkInput({ itemType: 'PROPERTY', itemId: 'p' })), 'MEDIA_ID_REQUIRED');
  equal('bad itemType', reason(() => svc.normalizeLinkInput({ mediaId: 'm', itemType: 'HOTEL', itemId: 'p' })), 'INVALID_ITEM_TYPE');
  equal('no itemId', reason(() => svc.normalizeLinkInput({ mediaId: 'm', itemType: 'PROPERTY' })), 'ITEM_ID_REQUIRED');
  equal('empty payload', reason(() => svc.normalizeLinkInput({})), 'MEDIA_ID_REQUIRED');
  equal('undefined payload does not crash', reason(() => svc.normalizeLinkInput()), 'MEDIA_ID_REQUIRED');
});

describe('optional fields default cleanly', () => {
  const out = svc.normalizeLinkInput({ mediaId: 'm', itemType: 'PACKAGE', itemId: 'pk' });
  equal('no action -> null (inherit agency default)', out.actionOverride, null);
  equal('no form slug -> null', out.formSlug, null);
  equal('no permalink -> null', out.permalink, null);
  equal('an unknown action string -> null, not passed through', svc.normalizeLinkInput({ mediaId: 'm', itemType: 'VISA', itemId: 'v', actionOverride: 'CALL_ME' }).actionOverride, null);
});
