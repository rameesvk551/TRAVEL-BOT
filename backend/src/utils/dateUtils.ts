// FILE: /backend/src/utils/dateUtils.js
// DEPS: none

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // +05:30

/**
 * Converts a UTC Date to IST (Asia/Kolkata) display string.
 * @param {Date|string} date - UTC date
 * @param {object} [options] - Intl.DateTimeFormat options
 * @returns {string} Formatted IST date string
 */
function toIST(date, options = {}) {
  const d = new Date(date);
  return d.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    ...options,
  });
}

/**
 * Returns the current time in IST.
 * @returns {Date} Current time adjusted to IST
 */
function nowIST() {
  return new Date(Date.now() + IST_OFFSET_MS);
}

/**
 * Creates a Date object set to a specific hour in IST.
 * Useful for scheduling jobs at "9:00 AM IST".
 * @param {Date|string} date - The base date
 * @param {number} hour - Hour in IST (0-23)
 * @param {number} [minute=0] - Minute
 * @returns {Date} UTC Date that corresponds to the given IST time
 */
function setISTTime(date, hour, minute = 0) {
  const d = new Date(date);
  // Set UTC time to the IST equivalent
  d.setUTCHours(hour - 5, minute - 30, 0, 0);
  // Handle underflow (negative minutes)
  return new Date(d.getTime());
}

/**
 * Calculates delay in milliseconds from now until a target Date.
 * Returns 0 if the target is in the past.
 * @param {Date|string} targetDate - The target date
 * @returns {number} Delay in milliseconds
 */
function delayUntil(targetDate) {
  const target = new Date(targetDate).getTime();
  const now = Date.now();
  return Math.max(0, target - now);
}

/**
 * Adds days to a date and returns a new Date.
 * @param {Date|string} date - Base date
 * @param {number} days - Days to add (can be negative)
 * @returns {Date} New date
 */
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Formats a date for WhatsApp display: "15 Dec 2026"
 * @param {Date|string} date - The date
 * @returns {string} Formatted date
 */
function formatDateShort(date) {
  return toIST(date, { day: 'numeric', month: 'short', year: 'numeric' });
}

/**
 * Parses natural date text like "15 Dec - 20 Dec" into start/end dates.
 * @param {string} text - Natural date string
 * @returns {{ start: Date|null, end: Date|null }} Parsed dates
 */
function parseDateRange(text) {
  if (!text) return { start: null, end: null };

  // Try formats: "15 Dec - 20 Dec", "Dec 15 - Dec 20", "15/12 - 20/12"
  const months = {
    jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5,
    jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11,
  };

  // Pattern: DD Mon - DD Mon
  const match = text.match(/(\d{1,2})\s*([a-z]+)\s*[-–to]+\s*(\d{1,2})\s*([a-z]+)/i);
  if (match) {
    const year = new Date().getFullYear();
    const startMonth = months[match[2].toLowerCase().slice(0, 3)];
    const endMonth = months[match[4].toLowerCase().slice(0, 3)];
    if (startMonth !== undefined && endMonth !== undefined) {
      const start = new Date(Date.UTC(year, startMonth, parseInt(match[1])));
      const end = new Date(Date.UTC(year, endMonth, parseInt(match[3])));
      // If dates are in the past, assume next year
      if (start < new Date()) {
        start.setFullYear(start.getFullYear() + 1);
        end.setFullYear(end.getFullYear() + 1);
      }
      return { start, end };
    }
  }

  return { start: null, end: null };
}

module.exports = {
  toIST,
  nowIST,
  setISTTime,
  delayUntil,
  addDays,
  formatDateShort,
  parseDateRange,
};
