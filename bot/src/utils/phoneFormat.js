// Format a stored phone number into wa.me-compatible digits (international, no '+').
// Agent/staff numbers are stored inconsistently ("9605734995", "09605734995",
// "+919900030003"); wa.me needs the full international number with a country code and no
// leading zero. Defaults to India (+91) for bare 10-digit numbers, matching the rest of the bot.
function toWaMeNumber(phone, defaultCountryCode = '91') {
  let digits = String(phone || '').replace(/[^0-9]/g, '');
  if (!digits) return '';
  digits = digits.replace(/^0+/, ''); // drop leading zeros (e.g. 0XXXXXXXXXX)
  if (digits.length === 10) digits = `${defaultCountryCode}${digits}`; // bare local mobile -> add country code
  return digits;
}

module.exports = { toWaMeNumber };
