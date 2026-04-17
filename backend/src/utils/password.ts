const crypto = require('crypto');

function generateTemporaryPassword(length = 12) {
  const safeLength = Math.max(8, Math.min(length, 32));
  const raw = crypto.randomBytes(safeLength).toString('base64url');
  const base = raw.slice(0, safeLength);

  return `${base}A1!`;
}

module.exports = {
  generateTemporaryPassword,
};
