import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/auth';
import { getErrorResponse } from '@/lib/apiError';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const classId = Number((await params).id);
  if (Number.isNaN(classId)) {
    return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });
  }
  const list = await prisma.classExaminee.findMany({
    where: { classId },
    include: { examinee: true },
    orderBy: [{ id: 'asc' }],
  });
  return NextResponse.json(list);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const classId = Number((await params).id);
  if (Number.isNaN(classId)) {
    return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });
  }
  try {
    const body = await req.json();
    const { examineeId } = body;
    if (examineeId == null) {
      return NextResponse.json({ error: 'Vui lòng chọn thí sinh' }, { status: 400 });
    }
    const created = await prisma.classExaminee.create({
      data: {
        classId,
        examineeId: Number(examineeId),
      },
      include: { examinee: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e: unknown) {
    const prismaError = e as { code?: string };
    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'Thí sinh này đã thuộc lớp khác (mỗi thí sinh chỉ được ở một lớp)' },
        { status: 400 }
      );
    }
    const { message, status } = getErrorResponse(e);
    return NextResponse.json({ error: message }, { status });
  }
}
