import { NextResponse } from 'next/server';
import { verifyExaminee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/** Xóa trạng thái enroll (histogram + bước pose) trên Gaze service cho MSSV hiện tại — khi hủy hoặc làm lại chưa đủ bước. */
export async function POST() {
  const auth = await verifyExaminee();
  if (!auth) {
    return NextResponse.json({ error: 'Vui lòng đăng nhập thí sinh' }, { status: 401 });
  }

  try {
    const examinee = await prisma.examinee.findUnique({
      where: { id: auth.examineeId },
      select: { mssv: true },
    });
    const studentId = examinee?.mssv?.trim() ?? '';
    if (!studentId) {
      return NextResponse.json({ error: 'Không tìm thấy MSSV thí sinh' }, { status: 500 });
    }

    const serviceUrl = process.env.PROCTORING_SERVICE_URL;
    if (serviceUrl) {
      await fetch(`${serviceUrl.replace(/\/$/, '')}/proctoring/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ student_id: studentId }),
      }).catch(() => undefined);
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: 'Lỗi reset enroll' }, { status: 500 });
  }
}
