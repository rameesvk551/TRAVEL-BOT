// The reel→WhatsApp handoff rides on a short code inside agency-written copy.
//
// WhatsApp gives an organic wa.me link NO hidden metadata — the prefilled text is the only
// carrier, and the customer can see and edit it before sending. So the code has to survive a
// human: re-typed casing, extra words, a rewritten sentence. And when the agency writes their
// own copy and forgets the {{code}} placeholder, we must still append it — otherwise
// attribution silently returns nothing and nobody notices.

const path = require('path');
const { describe, ok, equal } = require('./_harness');

const ref = require(path.resolve(__dirname, '../src/utils/reelRefCode.ts'));

describe('a code is pulled out of whatever the customer actually sends', () => {
  equal(
    'the copy we generate',
    ref.extractRefCode("Hi! I'd like details on Sunset Villa (#7K2Q9)"),
    '7K2Q9',
  );
  equal('bare code', ref.extractRefCode('#7K2Q9'), '7K2Q9');
  equal('lowercased by the customer', ref.extractRefCode('hi #7k2q9'), '7K2Q9');
  equal('code mid-sentence', ref.extractRefCode('is #7K2Q9 still available for december?'), '7K2Q9');
  equal('customer rewrote the sentence but kept the tag', ref.extractRefCode('yo whats the price #7K2Q9 thanks'), '7K2Q9');
  equal('trailing punctuation', ref.extractRefCode('interested in #7K2Q9.'), '7K2Q9');
});

describe('and is NOT invented out of ordinary messages', () => {
  equal('plain enquiry', ref.extractRefCode('do you have rooms in december?'), '');
  equal('no hash', ref.extractRefCode('7K2Q9'), '');
  equal('a hashtag is not a ref code', ref.extractRefCode('love this #maldives'), '');
  equal('too short', ref.extractRefCode('#7K2Q'), '');
  equal('too long — must not silently truncate to a valid-looking code', ref.extractRefCode('#7K2Q9X'), '');
  equal('empty', ref.extractRefCode(''), '');
  equal('null is not a crash', ref.extractRefCode(null), '');
  equal('undefined is not a crash', ref.extractRefCode(undefined), '');
  equal('non-string is not a crash', ref.extractRefCode({ text: '#7K2Q9' }), '');
});

describe('generated codes avoid characters humans mistype', () => {
  // A customer may retype this by hand off a screenshot. O/0 and I/1/L are the classic swaps.
  const seq = [0, 0.2, 0.4, 0.6, 0.8, 0.99];
  let i = 0;
  const rng = () => seq[i++ % seq.length];

  const code = ref.generateRefCode(rng);
  equal('is 5 characters', code.length, 5);
  ok('contains no O, 0, I, 1 or L', !/[O0I1L]/.test(code), code);
  ok('round-trips through the extractor', ref.extractRefCode(`#${code}`) === code, code);
  ok('is valid by its own checker', ref.isValidRefCode(code), code);

  ok('rejects an ambiguous character', !ref.isValidRefCode('7K2QO'), 'O should be rejected');
  ok('rejects wrong length', !ref.isValidRefCode('7K2Q'), 'too short');
});

describe('the handoff copy is the agency\'s, but the code is never lost', () => {
  equal(
    'placeholders are filled',
    ref.buildHandoffText('Hi! I would like details on {{item}} (#{{code}})', { item: 'Sunset Villa', code: '7K2Q9' }),
    'Hi! I would like details on Sunset Villa (#7K2Q9)',
  );
  equal(
    'agency forgot {{code}} -> we append it rather than lose attribution',
    ref.buildHandoffText('Tell me about {{item}}', { item: 'Sunset Villa', code: '7K2Q9' }),
    'Tell me about Sunset Villa (#7K2Q9)',
  );
  equal(
    'no template at all -> a sane default that still carries the code',
    ref.extractRefCode(ref.buildHandoffText('', { item: 'Sunset Villa', code: '7K2Q9' })),
    '7K2Q9',
  );
  equal(
    'an unknown placeholder is left alone, not blanked',
    ref.buildHandoffText('Ref #{{code}} {{nope}}', { item: 'X', code: '7K2Q9' }),
    'Ref #7K2Q9 {{nope}}',
  );
  equal(
    'a bare {{code}} with no # is NOT extractable, so the # form is appended',
    ref.buildHandoffText('Ref {{code}}', { item: 'X', code: '7K2Q9' }),
    'Ref 7K2Q9 (#7K2Q9)',
  );
});
