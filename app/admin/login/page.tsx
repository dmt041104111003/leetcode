import { redirect } from 'next/navigation';
import { verifyAdmin } from '@/lib/auth';
import AdminLoginForm from '@/app/admin/components/AdminLoginForm';

export default async function AdminLoginPage() {
  const ok = await verifyAdmin();
  if (ok) redirect('/admin/sessions');
  return <AdminLoginForm />;
}
