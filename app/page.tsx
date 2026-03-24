import { Suspense } from 'react';
import { verifyExaminee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ExamineeHome from '@/app/examinee/components/ExamineeHome';

export default async function Home() {
  const auth = await verifyExaminee();
  let examinee: { fullName: string; mssv: string } | null = null;
  if (auth) {
    const e = await prisma.examinee.findUnique({
      where: { id: auth.examineeId },
      select: { fullName: true, mssv: true },
    });
    if (e) examinee = { fullName: e.fullName ?? e.mssv, mssv: e.mssv };
  }

  return (
    <Suspense fallback={<main className="min-h-screen bg-gray-50" />}>
      <ExamineeHome examinee={examinee} />
    </Suspense>
  );
}
