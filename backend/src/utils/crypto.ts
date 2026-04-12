// FILE: /backend/src/utils/crypto.js
// DEPS: crypto-js
// ENV: ENCRYPTION_KEY

const CryptoJS = require('crypto-js');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_key_change_me_in_production';

/**
 * Encrypts a plaintext string using AES-256.
 * Used to encrypt Razorpay secrets at rest.
 * @param {string} plainText - The text to encrypt
 * @returns {string} The encrypted ciphertext
 */
function encrypt(plainText) {
  if (!plainText) return null;
  return CryptoJS.AES.encrypt(plainText, ENCRYPTION_KEY).toString();
}

/**
 * Decrypts an AES-256 encrypted string.
 * @param {string} cipherText - The encrypted text
 * @returns {string} The decrypted plaintext
 */
function decrypt(cipherText) {
  if (!cipherText) return null;
  const bytes = CryptoJS.AES.decrypt(cipherText, ENCRYPTION_KEY);
  return bytes.toString(CryptoJS.enc.Utf8);
}

module.exports = { encrypt, decrypt };
