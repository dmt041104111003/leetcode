export function formatDateTime(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
}

export function toDatetimeLocal(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
