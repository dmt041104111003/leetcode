import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/auth';
import { getErrorResponse } from '@/lib/apiError';

export async function GET(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const sessionIdParam = searchParams.get('sessionId');
  const search = searchParams.get('search')?.trim() ?? '';

  const sessionId = sessionIdParam ? parseInt(sessionIdParam, 10) : undefined;
  const hasSession = typeof sessionId === 'number' && !Number.isNaN(sessionId);
  const availableForClass = searchParams.get('availableForClass') === '1';

  type Where = {
    id?: number;
    OR?: Array<{ mssv?: { contains: string; mode: 'insensitive' }; fullName?: { contains: string; mode: 'insensitive' } }>;
    sessions?: { some: { sessionId: number } };
    classes?: { none?: object };
  };
  const where: Where = {};
  if (search) {
    const searchNum = parseInt(search, 10);
    if (!Number.isNaN(searchNum)) {
      where.id = searchNum;
    } else {
      where.OR = [
        { mssv: { contains: search, mode: 'insensitive' } },
        { fullName: { contains: search, mode: 'insensitive' } },
      ];
    }
  }
  if (hasSession) {
    where.sessions = { some: { sessionId } };
  }
  if (availableForClass) {
    where.classes = { none: {} };
  }

  const list = await prisma.examinee.findMany({
    where: Object.keys(where).length ? where : undefined,
    orderBy: [{ mssv: 'asc' }],
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { mssv, fullName } = body;
    if (!mssv) {
      return NextResponse.json({ error: 'Vui lòng nhập MSSV' }, { status: 400 });
    }
    const created = await prisma.examinee.create({
      data: {
        mssv: String(mssv).trim(),
        fullName: fullName != null ? String(fullName).trim() || null : null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    const { message, status } = getErrorResponse(e);
    return NextResponse.json({ error: message }, { status });
  }
}
