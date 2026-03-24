'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import AdminLoginForm from '@/app/admin/components/AdminLoginForm';

function ExamineeLoginContent() {
  const searchParams = useSearchParams();
  const sessionCode = searchParams.get('sessionCode') ?? undefined;

  return (
    <main className="min-h-screen m-0 p-0">
      <AdminLoginForm initialSessionCode={sessionCode || undefined} />
    </main>
  );
}

export default function ExamineeLoginPage() {
  return (
    <Suspense fallback={<main className="min-h-screen m-0 p-0 bg-white" />}>
      <ExamineeLoginContent />
    </Suspense>
  );
}
