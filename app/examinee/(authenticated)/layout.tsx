import { redirect } from 'next/navigation';
import { verifyExaminee } from '@/lib/auth';

export default async function AuthenticatedExamineeLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const auth = await verifyExaminee();
  if (!auth) redirect('/');
  return <>{children}</>;
}
