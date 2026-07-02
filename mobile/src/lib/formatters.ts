// FILE: mobile/src/lib/formatters.ts
// Money/date/phone formatters — ported from frontend/src/utils/formatters.js
// with TypeScript types. All amounts stored in paise, displayed as INR.

/**
 * Formats paise to Indian Rupee display string.
 * @param paise Amount in paise (₹ × 100)
 * @returns Formatted currency e.g. "₹1,500"
 */
export function formatCurrency(paise: number | null | undefined): string {
  if (paise == null) return '₹0';
  const rupees = paise / 100;
  return `₹${rupees.toLocaleString('en-IN')}`;
}

/**
 * Compact currency for small spaces — "₹1.5L", "₹45K", "₹500"
 */
export function formatCurrencyCompact(paise: number | null | undefined): string {
  if (paise == null) return '₹0';
  const rupees = paise / 100;
  if (rupees >= 100000) return `₹${(rupees / 100000).toFixed(1)}L`;
  if (rupees >= 1000) return `₹${(rupees / 1000).toFixed(rupees >= 10000 ? 0 : 1)}K`;
  return `₹${rupees.toLocaleString('en-IN')}`;
}

/**
 * Formats a date for display in IST.
 * @returns e.g. "15 Dec 2026"
 */
export function formatDate(
  date: string | Date | null | undefined,
  options: Intl.DateTimeFormatOptions = {},
): string {
  if (!date) return '-';
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
 * @returns e.g. "15 Dec 2026, 2:30 PM"
 */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '-';
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
 * @returns e.g. "2:30 PM"
 */
export function formatTime(date: string | Date | null | undefined): string {
  if (!date) return '';
  return new Date(date).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Returns relative time string like "2m ago", "1h ago".
 */
export function timeAgo(date: string | Date | null | undefined): string {
  if (!date) return '';
  const seconds = Math.floor((Date.now() - new Date(date).getTime()) / 1000);
  if (seconds < 0) return 'just now';
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}d ago`;
  return formatDate(date);
}

/**
 * Formats an Indian phone number for display.
 * @returns e.g. "+91 98765 43210"
 */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return '';
  if (phone.length >= 13 && phone.startsWith('+91')) {
    const digits = phone.slice(3);
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone;
}

/**
 * Truncates text to a max length with ellipsis.
 */
export function truncate(text: string | null | undefined, max: number = 50): string {
  if (!text) return '';
  return text.length > max ? text.substring(0, max) + '…' : text;
}

/**
 * Formats a percentage with 1 decimal.
 */
export function formatPercent(value: number | null | undefined): string {
  if (value == null) return '0%';
  return `${value.toFixed(1)}%`;
}

/**
 * Returns a sign-prefixed delta string for metric cards.
 * @returns e.g. "+12.5%" or "-3.2%"
 */
export function formatDelta(value: number | null | undefined): string {
  if (value == null) return '0%';
  const sign = value >= 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}
