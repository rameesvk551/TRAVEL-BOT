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

export function getStatusTone(status) {
  const tones = {
    JUST_CONTACTED: 'bg-sky-100 text-sky-700',
    PACKAGE_SEARCHED: 'bg-amber-100 text-amber-700',
    PACKAGE_INTERESTED: 'bg-indigo-100 text-indigo-700',
    CONTACTED: 'bg-violet-100 text-violet-700',
    BOOKED: 'bg-emerald-100 text-emerald-700',
    LOST: 'bg-rose-100 text-rose-700',
    UNKNOWN: 'bg-slate-100 text-slate-600',
    // Legacy maps for backwards compatibility
    NEW: 'bg-sky-100 text-sky-700',
    QUOTED: 'bg-indigo-100 text-indigo-700',
    NEGOTIATING: 'bg-violet-100 text-violet-700',
    CANCELLED: 'bg-slate-200 text-slate-600',
    PENDING: 'bg-amber-100 text-amber-700',
    CONFIRMED: 'bg-emerald-100 text-emerald-700',
    COMPLETED: 'bg-teal-100 text-teal-700',
    FAILED: 'bg-rose-100 text-rose-700',
    EXPIRED: 'bg-rose-100 text-rose-700',
    REFUNDED: 'bg-slate-200 text-slate-700',
  };

  return tones[status] || 'bg-slate-100 text-slate-600';
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
