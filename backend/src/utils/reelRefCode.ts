// Short codes that carry a reel (and the catalog item it was mapped to) from an Instagram DM
// into a WhatsApp chat.
//
// An organic wa.me link has no hidden metadata: the prefilled text is the ONLY carrier, and the
// customer sees it and can edit it before hitting send. So the code has to be short enough to
// look like a reference tag rather than a tracking blob, unambiguous enough to survive being
// retyped by hand, and strict enough that an ordinary "#maldives" is never mistaken for one.
//
// (Click-to-WhatsApp ads are the exception — Meta attaches a hidden `referral` object there, so
// no code is needed on that path. See adReferralService.)

// No O/0, no I/1/L: the characters people swap when copying from a screenshot.
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
const CODE_LENGTH = 5;

// The trailing lookahead rejects `#7K2Q9X` outright instead of truncating it to a valid-looking
// `7K2Q9` and resolving to the wrong reel — a silent misattribution is worse than no match.
const CODE_RE = new RegExp(`#([${ALPHABET}]{${CODE_LENGTH}})(?![0-9A-Za-z])`, 'i');

function isValidRefCode(code: any): boolean {
  if (typeof code !== 'string' || code.length !== CODE_LENGTH) return false;
  return code.toUpperCase().split('').every((ch) => ALPHABET.includes(ch));
}

// rng is injectable so the generator is testable; callers use the default.
function generateRefCode(rng: () => number = Math.random): string {
  let out = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    const idx = Math.min(ALPHABET.length - 1, Math.floor(rng() * ALPHABET.length));
    out += ALPHABET[idx];
  }
  return out;
}

function formatRefCode(code: string): string {
  return `#${String(code || '').toUpperCase()}`;
}

// Returns '' when the message carries no code — the common case, and not an error.
function extractRefCode(text: any): string {
  if (typeof text !== 'string' || !text) return '';
  const match = text.match(CODE_RE);
  return match ? match[1].toUpperCase() : '';
}

// The agency owns this copy. We only guarantee the code survives it: if their template omits
// {{code}}, appending it is the difference between working attribution and a feature that
// quietly reports nothing.
function buildHandoffText(template: string, vars: { item?: string; code: string }): string {
  const code = String(vars.code || '').toUpperCase();
  const base = String(template || '').trim() || 'Hi! I would like details on {{item}} (#{{code}})';

  let text = base
    .replace(/\{\{\s*item\s*\}\}/gi, String(vars.item || '').trim())
    .replace(/\{\{\s*code\s*\}\}/gi, code)
    .replace(/\s{2,}/g, ' ')
    .trim();

  if (code && !extractRefCode(text)) text = `${text} (${formatRefCode(code)})`.trim();
  return text;
}

module.exports = {
  ALPHABET,
  CODE_LENGTH,
  isValidRefCode,
  generateRefCode,
  formatRefCode,
  extractRefCode,
  buildHandoffText,
};
