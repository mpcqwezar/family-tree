export function resolveAssetPath(pathname) {
  const base = import.meta.env.BASE_URL || './';
  return new URL(pathname, new URL(base, window.location.href)).toString();
}

export function safeText(value) {
  if (!value && value !== 0) return '—';
  return String(value).trim();
}
