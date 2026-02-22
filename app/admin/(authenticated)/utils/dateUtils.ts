export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}
