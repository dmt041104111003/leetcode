import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyExaminee, setExamineeCookie } from '@/lib/auth';
import { getErrorResponse } from '@/lib/apiError';

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyExaminee();
    if (!auth) {
      return NextResponse.json(
        { error: 'Vui lòng đăng nhập thí sinh trước' },
        { status: 401 }
      );
    }
    const { sessionCode } = await req.json();
    const code = typeof sessionCode === 'string' ? sessionCode.trim() : '';
    if (!code) {
      return NextResponse.json(
        { error: 'Vui lòng nhập mã ca thi' },
        { status: 400 }
      );
    }
    const session = await prisma.session.findUnique({
      where: { code },
    });
    if (!session) {
      return NextResponse.json(
        { error: 'Mã ca thi không tồn tại' },
        { status: 404 }
      );
    }
    const link = await prisma.sessionExaminee.findUnique({
      where: {
        sessionId_examineeId: { sessionId: session.id, examineeId: auth.examineeId },
      },
    });
    if (!link) {
      return NextResponse.json(
        { error: 'Bạn không thuộc ca thi này' },
        { status: 403 }
      );
    }
    await setExamineeCookie(auth.examineeId, session.id);
    return NextResponse.json({
      success: true,
      sessionId: session.id,
      sessionName: session.name,
    });
  } catch (e) {
    const { message, status } = getErrorResponse(e);
    return NextResponse.json({ error: message }, { status });
  }
}
