const VI_LOWER = 'àáạảãâầấậẩẫăằắặẳẵèéẹẻẽêềếệểễìíịỉĩòóọỏõôồốộổỗơờớợởỡùúụủũưừứựửữỳýỵỷỹđ';
const VI_ASCII = 'aaaaaaaaaaaaaaaaaeeeeeeeeeeeiiiiiooooooooooooooooouuuuuuuuuuuyyyyyyd';

export function slugify(text: string): string {
  if (!text || typeof text !== 'string') return '';
  let s = text.trim();
  for (let i = 0; i < VI_LOWER.length; i++) {
    s = s.replace(new RegExp(VI_LOWER[i], 'gi'), VI_ASCII[i]);
  }
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
