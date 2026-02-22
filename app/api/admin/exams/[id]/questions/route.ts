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
  const examId = Number((await params).id);
  if (Number.isNaN(examId)) {
    return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });
  }
  const list = await prisma.examQuestion.findMany({
    where: { examId },
    include: { problem: true },
    orderBy: [{ sortOrder: 'asc' }],
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
  const examId = Number((await params).id);
  if (Number.isNaN(examId)) {
    return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });
  }
  try {
    const body = await req.json();
    const { problemId, sortOrder, points } = body;
    if (problemId == null) {
      return NextResponse.json({ error: 'Vui lòng chọn câu hỏi' }, { status: 400 });
    }
    const maxOrder = await prisma.examQuestion.aggregate({
      where: { examId },
      _max: { sortOrder: true },
    });
    const nextOrder = (maxOrder._max.sortOrder ?? -1) + 1;
    const created = await prisma.examQuestion.create({
      data: {
        examId,
        problemId: Number(problemId),
        sortOrder: sortOrder != null ? Number(sortOrder) : nextOrder,
        points: points != null ? Number(points) : null,
      },
      include: { problem: true },
    });
    return NextResponse.json(created, { status: 201 });
  } catch (e) {
    const { message, status } = getErrorResponse(e);
    return NextResponse.json({ error: message }, { status });
  }
}
