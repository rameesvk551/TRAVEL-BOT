export function roleLabel(role) {
  const normalized = String(role || '').toUpperCase();
  if (normalized === 'AGENT') return 'Staff';
  if (normalized === 'ADMIN') return 'Admin';
  return role || '-';
}

