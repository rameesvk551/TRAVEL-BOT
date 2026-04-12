// FILE: /backend/src/utils/phoneUtils.js
// DEPS: none

/**
 * Normalizes an Indian phone number to E.164 format (+91XXXXXXXXXX).
 * Handles inputs like: 9876543210, 09876543210, 919876543210, +919876543210
 * @param {string} phone - The raw phone number
 * @returns {string} The normalized E.164 phone number
 */
function normalizePhone(phone) {
  if (!phone) return null;
  let cleaned = phone.replace(/[\s\-\(\)\.]/g, '');

  // Already in E.164
  if (/^\+91\d{10}$/.test(cleaned)) return cleaned;

  // Remove leading +
  if (cleaned.startsWith('+')) cleaned = cleaned.slice(1);

  // Remove leading 0
  if (cleaned.startsWith('0')) cleaned = cleaned.slice(1);

  // If starts with 91 and is 12 digits, it already has country code
  if (cleaned.startsWith('91') && cleaned.length === 12) {
    return `+${cleaned}`;
  }

  // 10-digit Indian number
  if (/^\d{10}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  // Return as-is if we can't normalize (log for debugging)
  console.error('[phoneUtils] Could not normalize phone:', phone);
  return phone;
}

/**
 * Validates that a phone number is a valid Indian mobile number.
 * @param {string} phone - The phone number (any format)
 * @returns {boolean} True if valid
 */
function isValidIndianPhone(phone) {
  const normalized = normalizePhone(phone);
  return /^\+91[6-9]\d{9}$/.test(normalized);
}

/**
 * Formats a phone number for display: +91 98765 43210
 * @param {string} phone - E.164 format phone
 * @returns {string} Formatted phone number
 */
function formatPhoneDisplay(phone) {
  const normalized = normalizePhone(phone);
  if (!normalized || normalized.length < 13) return phone;
  const digits = normalized.slice(3); // Remove +91
  return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
}

module.exports = { normalizePhone, isValidIndianPhone, formatPhoneDisplay };
