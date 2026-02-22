import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export type SessionStatus = 'upcoming' | 'active' | 'ended';

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')?.trim();
  if (!code) {
    return NextResponse.json({ error: 'Vui lòng nhập mã ca thi' }, { status: 400 });
  }
  const session = await prisma.session.findUnique({
    where: { code },
    select: { id: true, code: true, name: true, startAt: true, endAt: true },
  });
  if (!session) {
    return NextResponse.json({ error: 'Mã ca thi không tồn tại' }, { status: 404 });
  }
  const now = new Date();
  const start = new Date(session.startAt);
  const end = new Date(session.endAt);
  let status: SessionStatus = 'upcoming';
  if (now >= start && now <= end) status = 'active';
  else if (now > end) status = 'ended';
  return NextResponse.json({
    session: {
      id: session.id,
      code: session.code,
      name: session.name,
      startAt: session.startAt,
      endAt: session.endAt,
    },
    status,
  });
}
