export function decodeHtmlEntities(s: string): string {
  if (typeof s !== 'string') return '';
  const doc = typeof document !== 'undefined' ? document : null;
  if (doc) {
    const el = doc.createElement('textarea');
    el.innerHTML = s;
    return el.value;
  }
  return s
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&#x27;|&#39;/g, "'");
}
