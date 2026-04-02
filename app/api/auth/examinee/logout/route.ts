import { NextResponse } from 'next/server';
import { clearExamineeCookie, verifyExaminee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST() {
  const auth = await verifyExaminee();
  if (auth?.examineeId != null) {
    try {
      const ex = await prisma.examinee.findUnique({
        where: { id: auth.examineeId },
        select: { mssv: true },
      });
      const studentId = ex?.mssv?.trim() ?? '';
      const serviceUrl = process.env.PROCTORING_SERVICE_URL;
      if (serviceUrl) {
        await fetch(`${serviceUrl.replace(/\/$/, '')}/proctoring/reset`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(studentId ? { student_id: studentId } : {}),
        }).catch(() => undefined);
      }
    } catch {
      // ignore reset errors to avoid blocking logout
    }
  }
  await clearExamineeCookie();
  return NextResponse.json({ success: true });
}
