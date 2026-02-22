import { redirect } from 'next/navigation';
import { verifyAdmin } from '@/lib/auth';

export default async function AdminPage() {
  const ok = await verifyAdmin();
  if (ok) redirect('/admin/sessions');
  redirect('/admin/login');
}
