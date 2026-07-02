// Run: npx tsx src/services/leadSource.test.ts
import assert from 'assert';
import { resolveLeadSource } from './leadSource';

let passed = 0;
function it(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

it('uses explicit data.source when provided', () => {
  assert.strictEqual(resolveLeadSource({ source: 'website' }, { phone: 'ig_123' }), 'website');
});

it('falls back to customer.source when no data.source', () => {
  assert.strictEqual(resolveLeadSource({}, { source: 'instagram_ad', phone: '+91999' }), 'instagram_ad');
});

it('infers instagram from an ig_ prefixed customer phone (single underscore)', () => {
  assert.strictEqual(resolveLeadSource({}, { phone: 'ig_2148712459314678' }), 'instagram');
});

it('infers instagram from an ig__ prefixed customer phone (double underscore)', () => {
  // This is the exact bug from the screenshot: ig__... lead showing as WhatsApp.
  assert.strictEqual(resolveLeadSource({}, { phone: 'ig__2148712459314678' }), 'instagram');
});

it('infers instagram from data.customerPhone when no customer record', () => {
  assert.strictEqual(resolveLeadSource({ customerPhone: 'ig_999' }, null), 'instagram');
});

it('defaults to whatsapp_organic for a normal phone with no source', () => {
  assert.strictEqual(resolveLeadSource({}, { phone: '+919605734995' }), 'whatsapp_organic');
});

it('defaults to whatsapp_organic when nothing is known', () => {
  assert.strictEqual(resolveLeadSource({}, null), 'whatsapp_organic');
});

console.log(`\n${passed} passed`);
