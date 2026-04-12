// FILE: /frontend/src/utils/formatters.js

/**
 * Formats paise to Indian Rupee display string.
 * @param {number} paise - Amount in paise
 * @returns {string} Formatted currency e.g. "₹1,500"
 */
export function formatCurrency(paise) {
  if (!paise && paise !== 0) return '₹0';
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN')}`;
}

/**
 * Formats a date for display in IST.
 * @param {string|Date} date - Date to format
 * @param {object} options - Intl options
 * @returns {string} Formatted date
 */
export function formatDate(date, options = {}) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    ...options,
  });
}

/**
 * Formats a date with time for display.
 * @param {string|Date} date - Date to format
 * @returns {string} e.g. "15 Dec 2026, 2:30 PM"
 */
export function formatDateTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Formats time only.
 * @param {string|Date} date - Date to format
 * @returns {string} e.g. "2:30 PM"
 */
export function formatTime(date) {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Returns relative time string like "2 min ago", "1 hour ago".
 * @param {string|Date} date - Date to compare
 * @returns {string} Relative time
 */
export function timeAgo(date) {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(date);
}

/**
 * Formats a phone number for display.
 * @param {string} phone - E.164 phone number
 * @returns {string} e.g. "+91 98765 43210"
 */
export function formatPhone(phone) {
  if (!phone) return '';
  if (phone.length >= 13 && phone.startsWith('+91')) {
    const digits = phone.slice(3);
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone;
}

/**
 * Returns the status badge CSS class name.
 * @param {string} status - Lead/booking/payment status
 * @returns {string} CSS class
 */
export function getStatusBadgeClass(status) {
  const map = {
    NEW: 'badge-new',
    CONTACTED: 'badge-contacted',
    QUOTED: 'badge-quoted',
    NEGOTIATING: 'badge-quoted',
    BOOKED: 'badge-booked',
    LOST: 'badge-lost',
    CANCELLED: 'badge-lost',
    PENDING: 'badge-pending',
    CONFIRMED: 'badge-confirmed',
    COMPLETED: 'badge-booked',
    PAID: 'badge-paid',
    EXPIRED: 'badge-lost',
    FAILED: 'badge-failed',
    REFUNDED: 'badge-pending',
  };
  return map[status] || 'badge-new';
}

/**
 * Truncates text to a max length with ellipsis.
 * @param {string} text - Text to truncate
 * @param {number} max - Max characters
 * @returns {string} Truncated text
 */
export function truncate(text, max = 50) {
  if (!text) return '';
  return text.length > max ? text.substring(0, max) + '...' : text;
}
