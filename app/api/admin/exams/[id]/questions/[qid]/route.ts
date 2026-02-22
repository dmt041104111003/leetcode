import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/auth';
import { getErrorResponse } from '@/lib/apiError';

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; qid: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const examId = Number((await params).id);
  const qid = Number((await params).qid);
  if (Number.isNaN(examId) || Number.isNaN(qid)) {
    return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });
  }
  try {
    const existing = await prisma.examQuestion.findFirst({
      where: { id: qid, examId },
    });
    if (!existing) return NextResponse.json({ error: 'Không tìm thấy câu hỏi trong đề' }, { status: 404 });
    const body = await req.json();
    const data: Record<string, unknown> = {};
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder);
    if (body.points !== undefined) data.points = body.points != null ? Number(body.points) : null;
    const updated = await prisma.examQuestion.update({
      where: { id: qid },
      data: data as Parameters<typeof prisma.examQuestion.update>[0]['data'],
      include: { problem: true },
    });
    return NextResponse.json(updated);
  } catch (e) {
    const { message, status } = getErrorResponse(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; qid: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const examId = Number((await params).id);
  const qid = Number((await params).qid);
  if (Number.isNaN(examId) || Number.isNaN(qid)) {
    return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });
  }
  await prisma.examQuestion.deleteMany({
    where: { id: qid, examId },
  });
  return NextResponse.json({ success: true });
}
