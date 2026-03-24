import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/auth';
import { getErrorResponse } from '@/lib/apiError';

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const list = await prisma.class.findMany({
    orderBy: [{ id: 'asc' }],
    include: { _count: { select: { examinees: true } } },
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { code, name } = body;
    if (!code || !name) {
      return NextResponse.json(
        { error: 'Vui lòng nhập mã lớp và tên lớp' },
        { status: 400 }
      );
    }
    const created = await prisma.class.create({
      data: {
        code: String(code).trim(),
        name: String(name).trim(),
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    const { message, status } = getErrorResponse(e);
    return NextResponse.json({ error: message }, { status });
  }
}
