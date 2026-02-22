export const ADMIN_NAV_ITEMS = [
  { href: '/admin/sessions', label: 'Ca thi' },
  { href: '/admin/classes', label: 'Lớp' },
  { href: '/admin/examinees', label: 'Thí sinh' },
  { href: '/admin/problems', label: 'Câu hỏi' },
  { href: '/admin/exams', label: 'Đề thi' },
] as const;

export const LANGUAGES = [
  { id: 'en', label: 'English' },
  { id: 'vi', label: 'Tiếng Việt' },
  { id: 'zh', label: '中文' },
  { id: 'fr', label: 'Français' },
] as const;

export type LangId = (typeof LANGUAGES)[number]['id'];
