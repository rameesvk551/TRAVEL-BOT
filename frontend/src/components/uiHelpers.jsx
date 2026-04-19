export function getInitials(name, fallback = 'FC') {
  return (
    name
      ?.split(' ')
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || fallback
  );
}

/**
 * Returns semantic color classes for lead/booking statuses.
 * Uses vibrant, distinguishable colors so users can scan at a glance.
 */
export function getStatusTone(status) {
  const tones = {
    // ── Lead pipeline ──
    JUST_CONTACTED: 'bg-sky-100 text-sky-700',
    PACKAGE_SEARCHED: 'bg-amber-100 text-amber-700',
    PACKAGE_INTERESTED: 'bg-indigo-100 text-indigo-700',
    CONTACTED: 'bg-violet-100 text-violet-700',
    CONVERTED: 'bg-emerald-100 text-emerald-700',
    LOST: 'bg-rose-100 text-rose-700',
    UNKNOWN: 'bg-slate-100 text-slate-500',

    // ── Legacy / Booking ──
    NEW: 'bg-sky-100 text-sky-700',
    QUOTED: 'bg-indigo-100 text-indigo-700',
    NEGOTIATING: 'bg-violet-100 text-violet-700',
    CANCELLED: 'bg-rose-100 text-rose-700',
    PENDING: 'bg-amber-100 text-amber-700',
    CONFIRMED: 'bg-emerald-100 text-emerald-700',
    COMPLETED: 'bg-teal-100 text-teal-700',
    FAILED: 'bg-rose-100 text-rose-700',
    EXPIRED: 'bg-slate-100 text-slate-500',
    REFUNDED: 'bg-orange-100 text-orange-600',
    BOOKED: 'bg-emerald-100 text-emerald-700',
    PAID: 'bg-emerald-100 text-emerald-700',
  };

  return tones[status] || 'bg-slate-100 text-slate-600';
}

/**
 * Returns a dot-color for Kanban column headers.
 */
export function getStatusDotColor(status) {
  const dots = {
    JUST_CONTACTED: 'bg-sky-500',
    PACKAGE_SEARCHED: 'bg-amber-500',
    PACKAGE_INTERESTED: 'bg-indigo-500',
    CONTACTED: 'bg-violet-500',
    CONVERTED: 'bg-emerald-500',
    LOST: 'bg-rose-500',
  };
  return dots[status] || 'bg-slate-400';
}

/**
 * Returns a left-accent color for Kanban columns.
 */
export function getStatusAccent(status) {
  const accents = {
    JUST_CONTACTED: '#0ea5e9',
    PACKAGE_SEARCHED: '#f59e0b',
    PACKAGE_INTERESTED: '#6366f1',
    CONTACTED: '#8b5cf6',
    CONVERTED: '#10b981',
    LOST: '#f43f5e',
  };
  return accents[status] || '#94a3b8';
}

export function getRelativeDateLabel(dateValue) {
  if (!dateValue) return '';
  const date = new Date(dateValue);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(date);
  target.setHours(0, 0, 0, 0);
  const diffDays = Math.round((target - today) / 86400000);

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays > 1 && diffDays < 7) return `${diffDays} Days`;
  if (diffDays === -1) return 'Yesterday';
  return '';
}
