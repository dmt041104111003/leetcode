export function formatRemaining(ms: number): string {
  if (ms <= 0) return '00:00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return [h, m, s].map((n) => String(n).padStart(2, '0')).join(':');
}

export function formatDateTime(s: string): string {
  try {
    return new Date(s).toLocaleString('vi-VN', { dateStyle: 'short', timeStyle: 'short' });
  } catch {
    return s;
  }
}
