import { redirect } from 'next/navigation';
import { verifyAdmin } from '@/lib/auth';
import AdminLayoutClient from '../components/AdminLayoutClient';

export default async function AuthenticatedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const ok = await verifyAdmin();
  if (!ok) redirect('/admin/login');

  return <AdminLayoutClient>{children}</AdminLayoutClient>;
}
