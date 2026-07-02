// Lightweight typo-tolerant matcher used by the flow-builder SEARCH node.
// Pure functions, no DB / network — so it can be unit-tested in isolation.
//
// Strategy: the customer types a free word (e.g. "vila", "munar"); we compare it
// against the DISTINCT real values for a field that exist in the agency's own
// inventory (e.g. ["Villa","Hotel","Resort"] or ["Munnar","Kochi","Alleppey"])
// and snap to the closest one. No Postgres extension needed.

function normalize(value = '') {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Classic Levenshtein edit distance.
function levenshtein(a = '', b = '') {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  let curr = new Array(b.length + 1);
  for (let i = 1; i <= a.length; i += 1) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    [prev, curr] = [curr, prev];
  }
  return prev[b.length];
}

// 0..1 similarity between two normalized strings.
function similarity(a = '', b = '') {
  if (!a && !b) return 1;
  if (!a || !b) return 0;
  if (a === b) return 1;
  const maxLen = Math.max(a.length, b.length);
  return 1 - levenshtein(a, b) / maxLen;
}

// Best similarity of `input` against the candidate as a whole AND against each of
// the candidate's tokens — so "munnar" still matches a candidate like "Munnar, Kerala".
function scoreCandidate(input, candidate) {
  const whole = similarity(input, candidate);
  const tokenBest = candidate
    .split(' ')
    .filter(Boolean)
    .reduce((best, token) => Math.max(best, similarity(input, token)), 0);
  // Substring containment is a strong signal for multi-word location values.
  const contains = candidate.includes(input) || input.includes(candidate) ? 0.9 : 0;
  return Math.max(whole, tokenBest, contains);
}

function confidenceFor(score, inputLength) {
  if (score >= 0.999) return 'exact';
  // Short inputs (<=3 chars) need a higher bar to avoid spurious matches.
  const highBar = inputLength <= 3 ? 0.9 : 0.8;
  const medBar = inputLength <= 3 ? 0.75 : 0.6;
  if (score >= highBar) return 'high';
  if (score >= medBar) return 'medium';
  return 'none';
}

/**
 * Find the closest candidate to a (possibly misspelled) input.
 * @returns {{ value: string|null, score: number, confidence: 'exact'|'high'|'medium'|'none', input: string }}
 */
function bestMatch(rawInput, candidates = []) {
  const input = normalize(rawInput);
  const cleaned = (candidates || [])
    .map((c) => ({ raw: c, norm: normalize(c) }))
    .filter((c) => c.norm);
  if (!input || !cleaned.length) {
    return { value: null, score: 0, confidence: 'none', input };
  }
  let best = { raw: null, score: -1 };
  for (const cand of cleaned) {
    const score = scoreCandidate(input, cand.norm);
    if (score > best.score) best = { raw: cand.raw, score };
  }
  return {
    value: best.score > 0 ? best.raw : null,
    score: Number(best.score.toFixed(3)),
    confidence: best.score > 0 ? confidenceFor(best.score, input.length) : 'none',
    input,
  };
}

module.exports = { bestMatch, similarity, levenshtein, normalize };
