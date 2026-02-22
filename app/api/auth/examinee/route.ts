import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { setExamineeCookie } from '@/lib/auth';
import { getErrorResponse } from '@/lib/apiError';

export async function POST(req: NextRequest) {
  try {
    const { mssv, fullName } = await req.json();
    if (!mssv || typeof mssv !== 'string') {
      return NextResponse.json(
        { error: 'Vui lòng nhập mã sinh viên' },
        { status: 400 }
      );
    }
    const name = typeof fullName === 'string' ? fullName.trim() : '';
    if (!name) {
      return NextResponse.json(
        { error: 'Vui lòng nhập họ tên' },
        { status: 400 }
      );
    }
    const examinee = await prisma.examinee.findUnique({
      where: { mssv: mssv.trim() },
    });
    if (!examinee) {
      return NextResponse.json(
        { error: 'Mã sinh viên hoặc họ tên không đúng' },
        { status: 401 }
      );
    }
    if (examinee.fullName && examinee.fullName.toLowerCase() !== name.toLowerCase()) {
      return NextResponse.json(
        { error: 'Mã sinh viên hoặc họ tên không đúng' },
        { status: 401 }
      );
    }
    await setExamineeCookie(examinee.id);
    return NextResponse.json({ success: true, examineeId: examinee.id });
  } catch (e) {
    const { message, status } = getErrorResponse(e);
    return NextResponse.json({ error: message }, { status });
  }
}
