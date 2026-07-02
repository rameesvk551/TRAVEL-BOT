// Run: npx tsx src/constants/modules.test.ts
import assert from 'assert';
const { isApiPrefixAllowed } = require('./modules');

let passed = 0;
function it(name: string, fn: () => void) {
  fn();
  passed += 1;
  console.log(`  ok - ${name}`);
}

// A Marketing + CRM-only agency (e.g. the ayurvedic client).
const MARKETING_CRM = [
  '/leads', '/follow-ups', '/customers', '/whatsapp',
  '/flows', '/campaigns', '/templates', '/social', '/reviews', '/ads',
  '/agents', '/settings',
];

it('allows everything when no explicit preferences (default tenant)', () => {
  assert.strictEqual(isApiPrefixAllowed(null, '/api/bookings'), true);
  assert.strictEqual(isApiPrefixAllowed([], '/api/hrm'), true);
  assert.strictEqual(isApiPrefixAllowed(undefined, '/api/accounts'), true);
});

it('allows enabled CRM + marketing APIs for the restricted package', () => {
  assert.strictEqual(isApiPrefixAllowed(MARKETING_CRM, '/api/leads'), true);
  assert.strictEqual(isApiPrefixAllowed(MARKETING_CRM, '/api/customers'), true);
  assert.strictEqual(isApiPrefixAllowed(MARKETING_CRM, '/api/whatsapp'), true);
  assert.strictEqual(isApiPrefixAllowed(MARKETING_CRM, '/api/messages'), true);
  assert.strictEqual(isApiPrefixAllowed(MARKETING_CRM, '/api/campaigns'), true);
  assert.strictEqual(isApiPrefixAllowed(MARKETING_CRM, '/api/flows'), true);
  assert.strictEqual(isApiPrefixAllowed(MARKETING_CRM, '/api/templates'), true);
  assert.strictEqual(isApiPrefixAllowed(MARKETING_CRM, '/api/instagram'), true);
});

it('blocks disabled modules for the restricted package', () => {
  assert.strictEqual(isApiPrefixAllowed(MARKETING_CRM, '/api/bookings'), false);
  assert.strictEqual(isApiPrefixAllowed(MARKETING_CRM, '/api/packages'), false);
  assert.strictEqual(isApiPrefixAllowed(MARKETING_CRM, '/api/accounts'), false);
  assert.strictEqual(isApiPrefixAllowed(MARKETING_CRM, '/api/hrm'), false);
  assert.strictEqual(isApiPrefixAllowed(MARKETING_CRM, '/api/properties'), false);
  assert.strictEqual(isApiPrefixAllowed(MARKETING_CRM, '/api/quotations'), false);
});

it('always allows unmapped/core prefixes even when restricted', () => {
  assert.strictEqual(isApiPrefixAllowed(MARKETING_CRM, '/api/agencies'), true);
  assert.strictEqual(isApiPrefixAllowed(MARKETING_CRM, '/api/auth'), true);
  assert.strictEqual(isApiPrefixAllowed(MARKETING_CRM, '/api/branding'), true);
  assert.strictEqual(isApiPrefixAllowed(MARKETING_CRM, '/api/agents'), true);
});

it('grants a shared API when ANY granting module is enabled', () => {
  // /api/payments is granted by either /bookings or /accounts.
  assert.strictEqual(isApiPrefixAllowed(['/accounts'], '/api/payments'), true);
  assert.strictEqual(isApiPrefixAllowed(['/bookings'], '/api/payments'), true);
  assert.strictEqual(isApiPrefixAllowed(['/leads'], '/api/payments'), false);
});

console.log(`\n${passed} passed`);
