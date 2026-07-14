// Guards the flow builder against the failure mode that has bitten us repeatedly:
// a setting exists in the UI, the bot reads it, but the save-normalizer silently drops it —
// so the agency configures something, hits Save, and it quietly evaporates.
//
// These tests are static (no DB) and read the real source files, so they keep working as the
// codebase moves.

const fs = require('fs');
const path = require('path');
const { describe, ok, equal } = require('./_harness');

const ROOT = path.resolve(__dirname, '../..');
const AGENCY_SERVICE = path.join(ROOT, 'backend/src/services/agencyService.ts');
const BOT_FLOW = path.join(ROOT, 'bot/src/handlers/travelFlowHandler.js');
const IG_BUILDER = path.join(ROOT, 'frontend/src/pages/settings/SettingsInstagramFlowBuilder.jsx');

const svc = require('../src/services/agencyService');

const read = (p) => fs.readFileSync(p, 'utf8');
const uniq = (arr) => [...new Set(arr)].sort();

// ---------------------------------------------------------------------------
describe('flow node config is never silently dropped on save', () => {
  const persisted = new Set(
    uniq((read(AGENCY_SERVICE).match(/normalized\.[a-zA-Z0-9_]+/g) || []).map((m) => m.split('.')[1])),
  );
  const botReads = uniq((read(BOT_FLOW).match(/\bdata\.[a-zA-Z0-9_]+/g) || []).map((m) => m.split('.')[1]));

  const dropped = botReads.filter((field) => !persisted.has(field));

  ok(
    'every node field the BOT reads is persisted by normalizeGraphData',
    dropped.length === 0,
    dropped.length ? `bot reads but save drops: [${dropped.join(', ')}]` : '',
  );
});

// ---------------------------------------------------------------------------
describe('every node the builder can create, the bot can execute', () => {
  const paletteBlock = (read(IG_BUILDER).match(/const NODE_TYPES = \[[\s\S]*?\n\];/) || [''])[0];
  const uiTypes = uniq([...paletteBlock.matchAll(/\['([A-Z_]+)'/g)].map((m) => m[1]));
  const botTypes = new Set([...read(BOT_FLOW).matchAll(/node\.type === '([A-Z_]+)'/g)].map((m) => m[1]));

  const deadEnds = uiTypes.filter((t) => !botTypes.has(t));

  ok('builder palette is non-empty (the regex still matches)', uiTypes.length > 5, `found ${uiTypes.length}`);
  ok(
    'no builder node type dead-ends in the bot',
    deadEnds.length === 0,
    deadEnds.length ? `UI can create but bot never executes: [${deadEnds.join(', ')}]` : '',
  );
});

// ---------------------------------------------------------------------------
describe('Send PDF node keeps its configuration (regression: it was silently discarded)', () => {
  const out = svc.normalizeGraphData('SEND_ITEM_DOCUMENT', {
    catalogType: 'PACKAGE',
    documentSource: 'UPLOAD',
    documentCaption: 'Your itinerary',
    uploadedPdfUrl: 'https://cdn.example.com/a.pdf',
    uploadedPdfName: 'a.pdf',
  }, 'n1');

  equal('documentSource survives', out.documentSource, 'UPLOAD');
  equal('documentCaption survives', out.documentCaption, 'Your itinerary');
  equal('uploadedPdfUrl survives', out.uploadedPdfUrl, 'https://cdn.example.com/a.pdf');
  equal('uploadedPdfName survives', out.uploadedPdfName, 'a.pdf');

  const bad = svc.normalizeGraphData('SEND_ITEM_DOCUMENT', { documentSource: 'HACK' }, 'n2');
  equal('unknown source falls back to AUTO', bad.documentSource, 'AUTO');

  const notAUrl = svc.normalizeGraphData('SEND_ITEM_DOCUMENT', {
    documentSource: 'UPLOAD',
    uploadedPdfUrl: 'javascript:alert(1)',
  }, 'n3');
  equal('non-http upload url is rejected', notAUrl.uploadedPdfUrl, '');
});

// ---------------------------------------------------------------------------
describe('Catalog node keeps the location step + visa/cruise filters (regression)', () => {
  const out = svc.normalizeGraphData('CATALOG_LIST', {
    catalogType: 'PROPERTY',
    askLocationFirst: true,
    locationPrompt: 'Where to?',
    locationButtonLabel: 'Pick',
    locationListTitle: 'Areas',
    footerText: 'Reply Hi to restart',
    country: 'UAE',
    visaType: 'Tourist',
    destination: 'Goa',
    cruiseLine: 'Cordelia',
  }, 'n1');

  equal('askLocationFirst survives', out.askLocationFirst, true);
  equal('locationPrompt survives', out.locationPrompt, 'Where to?');
  equal('locationButtonLabel survives', out.locationButtonLabel, 'Pick');
  equal('locationListTitle survives', out.locationListTitle, 'Areas');
  equal('footerText survives', out.footerText, 'Reply Hi to restart');
  equal('visa country filter survives', out.country, 'UAE');
  equal('visa type filter survives', out.visaType, 'Tourist');
  equal('cruise destination filter survives', out.destination, 'Goa');
  equal('cruise line filter survives', out.cruiseLine, 'Cordelia');

  const off = svc.normalizeGraphData('CATALOG_LIST', { catalogType: 'PROPERTY' }, 'n2');
  equal('askLocationFirst defaults to false', off.askLocationFirst, false);
});

// ---------------------------------------------------------------------------
// The global bot-reads-vs-save-keeps audit above cannot see PER-NODE-TYPE gaps: a field can be
// whitelisted for one node type and silently dropped on another. pickPrompt was exactly that —
// kept on SEARCH, dropped on CATALOG_LIST, even though the bot prints it after catalog cards.
describe('pickPrompt is kept on BOTH node types that use it (per-type gap)', () => {
  for (const type of ['SEARCH', 'CATALOG_LIST']) {
    const out = svc.normalizeGraphData(type, {
      catalogType: 'PROPERTY',
      pickPrompt: 'Reply with a number for details.',
    }, 'n1');
    equal(`${type}: pickPrompt survives`, out.pickPrompt, 'Reply with a number for details.');
  }
});

// ---------------------------------------------------------------------------
describe('card buttons (Check Availability -> lead form) survive and are bounded', () => {
  const FORM = '11111111-2222-3333-4444-555555555555';
  for (const type of ['SEARCH', 'CATALOG_LIST']) {
    const out = svc.normalizeGraphData(type, {
      catalogType: 'PROPERTY',
      igCardMode: 'CAROUSEL',
      cardButtons: [
        { id: 'b1', label: 'Check Availability', action: 'LEAD_FORM', leadFormId: FORM },
        { id: 'b2', label: 'WhatsApp', action: 'WHATSAPP' },
        { id: 'b3', label: 'Site', action: 'URL', url: 'https://example.com' },
        { id: 'b4', label: 'Fourth', action: 'WHATSAPP' },
        { id: 'b5', label: '', action: 'WHATSAPP' },
      ],
    }, 'n1');
    const b = out.cardButtons || [];

    ok(`${type}: cardButtons survive`, b.length > 0, 'stripped!');
    ok(`${type}: capped at 3 (Instagram limit)`, b.length === 3, `got ${b.length}`);
    ok(`${type}: leadFormId kept (this is what links the property)`, b[0]?.leadFormId === FORM);
    ok(`${type}: blank label dropped`, !b.some((x) => !x.label));
  }

  const coerced = svc.normalizeCardButtons([{ id: 'x', label: 'Bogus', action: 'DESTROY_ALL' }]);
  equal('unknown action is coerced, never trusted', coerced[0]?.action, 'WHATSAPP');
});
