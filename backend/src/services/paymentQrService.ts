// FILE: /backend/src/services/paymentQrService.ts
//
// Builds a UPI "intent" QR code that any UPI app (Google Pay, PhonePe, Paytm,
// BHIM, …) can scan to pay a specific amount. The amount is encoded in the
// `am` parameter so the payer's app pre-fills the balance — they just confirm.
//
// Reference: NPCI UPI deep-link spec — upi://pay?pa=<vpa>&pn=<name>&am=<amt>&cu=INR
// Used on invoices/quotations to collect the outstanding balance.

const QRCode = require('qrcode');

/** Money in this app is stored in paise (minor units); UPI wants major rupees. */
function paiseToRupeeString(paise) {
  const numeric = Number(paise);
  const safe = Number.isFinite(numeric) ? Math.max(0, Math.round(numeric)) : 0;
  return (safe / 100).toFixed(2);
}

/** A VPA looks like `name@bank`. Loose validation — UPI handles are permissive. */
function isLikelyVpa(value) {
  const trimmed = String(value || '').trim();
  return /^[a-z0-9._-]{2,}@[a-z][a-z0-9.-]{1,}$/i.test(trimmed);
}

/**
 * Builds the `upi://pay?...` deep link with the amount pre-filled.
 * @param {{ vpa: string, payeeName?: string, amountPaise: number, note?: string }} opts
 * @returns {string|null} the UPI intent URL, or null if the VPA is invalid.
 */
function buildUpiIntent({ vpa, payeeName, amountPaise, note }) {
  if (!isLikelyVpa(vpa)) return null;
  const params = new URLSearchParams();
  params.set('pa', String(vpa).trim());
  params.set('pn', String(payeeName || 'Payee').trim().slice(0, 50) || 'Payee');
  const amount = paiseToRupeeString(amountPaise);
  if (Number(amount) > 0) params.set('am', amount);
  params.set('cu', 'INR');
  if (note) params.set('tn', String(note).trim().slice(0, 80));
  // URLSearchParams encodes spaces as '+'; UPI apps expect %20.
  return `upi://pay?${params.toString().replace(/\+/g, '%20')}`;
}

/**
 * Generates a balance-payment UPI QR as a PNG data URI suitable for embedding
 * in a Handlebars/HTML PDF. Returns null when there is nothing to collect or no
 * usable VPA, so callers can simply skip rendering the block.
 * @returns {Promise<{ dataUrl: string, upiIntent: string, amountRupees: string }|null>}
 */
async function buildBalancePaymentQr({ vpa, payeeName, balancePaise, note }) {
  if (!Number.isFinite(Number(balancePaise)) || Number(balancePaise) <= 0) return null;
  const upiIntent = buildUpiIntent({ vpa, payeeName, amountPaise: balancePaise, note });
  if (!upiIntent) return null;

  const dataUrl = await QRCode.toDataURL(upiIntent, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 240,
  });

  return { dataUrl, upiIntent, amountRupees: paiseToRupeeString(balancePaise) };
}

module.exports = {
  buildUpiIntent,
  buildBalancePaymentQr,
  isLikelyVpa,
};
