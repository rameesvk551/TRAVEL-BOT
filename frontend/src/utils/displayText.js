export function displayText(value, fallback = '-') {
  if (value === null || value === undefined || value === '') return fallback;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (Array.isArray(value)) {
    const text = value.map((item) => displayText(item, '')).filter(Boolean).join(', ');
    return text || fallback;
  }
  if (typeof value === 'object') {
    return displayText(
      value.label ?? value.name ?? value.message ?? value.error ?? value.status ?? value.type ?? value.code,
      fallback
    );
  }
  return fallback;
}

export function statusText(value, fallback = 'UNKNOWN') {
  return displayText(value, fallback).replace(/_/g, ' ');
}
