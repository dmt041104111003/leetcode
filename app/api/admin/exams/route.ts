import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/auth';
import { getErrorResponse } from '@/lib/apiError';

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const list = await prisma.exam.findMany({
    orderBy: [{ id: 'asc' }],
    include: { questions: { include: { problem: true }, orderBy: [{ sortOrder: 'asc' }] } },
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { code, name, description } = body;
    if (!code || !name) {
      return NextResponse.json(
        { error: 'Vui lòng nhập mã đề và tên đề thi' },
        { status: 400 }
      );
    }
    const created = await prisma.exam.create({
      data: {
        code: String(code).trim(),
        name: String(name).trim(),
        description: description != null && description !== '' ? String(description).trim() || null : null,
      },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: unknown) {
    const prismaError = e as { code?: string; meta?: { target?: string[] } };
    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'Mã đề thi đã tồn tại. Vui lòng chọn mã khác.' },
        { status: 400 }
      );
    }
    const { message, status } = getErrorResponse(e);
    return NextResponse.json({ error: message }, { status });
  }
}
