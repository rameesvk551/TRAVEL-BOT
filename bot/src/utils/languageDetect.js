// FILE: /bot/src/utils/languageDetect.js
// DEPS: none

// Malayalam keywords/phrases that indicate the user speaks Malayalam
const ML_KEYWORDS = [
  'hai', 'namaskaram', 'namaskkaaram', 'nanni', 'ennu', 'enikku',
  'venda', 'venam', 'aanu', 'aano', 'ille', 'illa', 'undo',
  'evideyanu', 'enthanu', 'enthaa', 'parayoo', 'sthalam', 'yatra',
  'pokam', 'varum', 'varu', 'sherri', 'shari', 'kollam', 'adipoli',
  'mathi', 'aavashyam', 'sahayam', 'trip', 'vishesham',
  'ningal', 'njan', 'ente', 'athu', 'ithu',
];

/**
 * Detects language from a message text.
 * Returns 'ML' if Malayalam keywords found, otherwise 'EN'.
 * @param {string} text - The message text
 * @returns {'EN' | 'ML'} Detected language
 */
function detectLanguage(text) {
  if (!text) return 'EN';
  const lower = text.toLowerCase().trim();

  for (const keyword of ML_KEYWORDS) {
    if (lower.includes(keyword)) {
      return 'ML';
    }
  }

  // Check for Malayalam Unicode characters (U+0D00–U+0D7F)
  if (/[\u0D00-\u0D7F]/.test(text)) {
    return 'ML';
  }

  return 'EN';
}

module.exports = { detectLanguage };
