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
    JUST_CONTACTED: 'bg-slate-200 text-slate-700',
    PACKAGE_SEARCHED: 'bg-slate-200 text-slate-700',
    PACKAGE_INTERESTED: 'bg-slate-300 text-slate-800',
    CONTACTED: 'bg-slate-300 text-slate-800',
    CONVERTED: 'bg-[#2d2d2d] text-white',
    LOST: 'bg-slate-100 text-slate-500',
    UNKNOWN: 'bg-slate-100 text-slate-500',
    // Legacy maps for backwards compatibility
    NEW: 'bg-slate-200 text-slate-700',
    QUOTED: 'bg-slate-300 text-slate-800',
    NEGOTIATING: 'bg-slate-300 text-slate-800',
    CANCELLED: 'bg-slate-100 text-slate-500',
    PENDING: 'bg-slate-200 text-slate-700',
    CONFIRMED: 'bg-[#2d2d2d] text-white',
    COMPLETED: 'bg-[#404040] text-white',
    FAILED: 'bg-slate-100 text-slate-500',
    EXPIRED: 'bg-slate-100 text-slate-500',
    REFUNDED: 'bg-slate-200 text-slate-600',
    BOOKED: 'bg-[#404040] text-white',
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
