// Run with: node bot/src/utils/fuzzyMatch.test.js
const assert = require('assert');
const { bestMatch, similarity } = require('./fuzzyMatch');

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed += 1;
    console.log(`  ok  ${name}`);
  } catch (err) {
    console.error(`FAIL  ${name}\n      ${err.message}`);
    process.exitCode = 1;
  }
}

const PROPERTY_TYPES = ['Villa', 'Hotel', 'Resort', 'Apartment'];
const LOCATIONS = ['Munnar', 'Kochi', 'Alleppey', 'Wayanad'];

check('exact match is exact', () => {
  const r = bestMatch('Villa', PROPERTY_TYPES);
  assert.strictEqual(r.value, 'Villa');
  assert.strictEqual(r.confidence, 'exact');
});

check('typo "vila" -> Villa (high)', () => {
  const r = bestMatch('vila', PROPERTY_TYPES);
  assert.strictEqual(r.value, 'Villa');
  assert.ok(['exact', 'high'].includes(r.confidence), `got ${r.confidence}`);
});

check('typo "munar" -> Munnar', () => {
  const r = bestMatch('munar', LOCATIONS);
  assert.strictEqual(r.value, 'Munnar');
  assert.ok(['exact', 'high', 'medium'].includes(r.confidence), `got ${r.confidence}`);
});

check('case-insensitive "RESORT" -> Resort', () => {
  const r = bestMatch('RESORT', PROPERTY_TYPES);
  assert.strictEqual(r.value, 'Resort');
});

check('matches a token inside a multi-word value', () => {
  const r = bestMatch('munnar', ['Munnar, Kerala', 'Kochi, Kerala']);
  assert.strictEqual(r.value, 'Munnar, Kerala');
});

check('garbage -> no match', () => {
  const r = bestMatch('zzqqxx', LOCATIONS);
  assert.strictEqual(r.value, null);
  assert.strictEqual(r.confidence, 'none');
});

check('empty input -> no match', () => {
  const r = bestMatch('', PROPERTY_TYPES);
  assert.strictEqual(r.value, null);
});

check('empty candidates -> no match', () => {
  const r = bestMatch('villa', []);
  assert.strictEqual(r.value, null);
});

check('short input needs a closer match (ab vs Villa = none)', () => {
  const r = bestMatch('ab', PROPERTY_TYPES);
  assert.strictEqual(r.confidence, 'none');
});

check('similarity bounds', () => {
  assert.strictEqual(similarity('a', 'a'), 1);
  assert.strictEqual(similarity('', ''), 1);
  assert.strictEqual(similarity('a', ''), 0);
});

console.log(`\n${passed} checks passed`);
