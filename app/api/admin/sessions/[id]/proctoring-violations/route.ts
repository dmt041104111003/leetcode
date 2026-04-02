import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessionId = Number((await params).id);
  const examineeIdParam = req.nextUrl.searchParams.get('examineeId');
  const classIdParam = req.nextUrl.searchParams.get('classId');
  const examineeId = examineeIdParam != null ? Number(examineeIdParam) : NaN;
  const classId = classIdParam != null ? Number(classIdParam) : null;

  if (Number.isNaN(sessionId)) {
    return NextResponse.json({ error: 'ID ca thi không hợp lệ' }, { status: 400 });
  }
  if (Number.isNaN(examineeId)) {
    return NextResponse.json({ error: 'examineeId là bắt buộc' }, { status: 400 });
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: {
      id: true,
      code: true,
      name: true,
      startAt: true,
      endAt: true,
      examId: true,
      exam: { select: { id: true, code: true, name: true } },
    },
  });
  if (!session) {
    return NextResponse.json({ error: 'Không tìm thấy ca thi' }, { status: 404 });
  }

  const examinee = await prisma.examinee.findUnique({
    where: { id: examineeId },
    select: { id: true, mssv: true, fullName: true },
  });
  if (!examinee) {
    return NextResponse.json({ error: 'Không tìm thấy thí sinh' }, { status: 404 });
  }

  if (classId != null && !Number.isNaN(classId)) {
    const inClass = await prisma.classExaminee.findFirst({
      where: { classId, examineeId },
      select: { id: true },
    });
    if (!inClass) {
      return NextResponse.json({ error: 'Thí sinh không thuộc lớp này' }, { status: 403 });
    }
  }

  const link = await prisma.sessionExaminee.findUnique({
    where: { sessionId_examineeId: { sessionId, examineeId } },
    select: { id: true },
  });
  if (!link) {
    return NextResponse.json({ error: 'Thí sinh không thuộc ca thi này' }, { status: 403 });
  }

  type ViolationRow = {
    id: number;
    violationType: string;
    message: string | null;
    facesCount: number | null;
    snapshotUrl: string | null;
    meta: unknown;
    createdAt: Date;
    examId: number | null;
  };

  const violations = (await prisma.proctoringViolation.findMany({
    where: { sessionId, examineeId },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      violationType: true,
      message: true,
      facesCount: true,
      snapshotUrl: true,
      meta: true,
      createdAt: true,
      examId: true,
    },
  })) as ViolationRow[];

  return NextResponse.json({
    session: {
      id: session.id,
      code: session.code,
      name: session.name,
      startAt: session.startAt,
      endAt: session.endAt,
    },
    exam: session.exam,
    examinee,
    violations: violations.map((v: ViolationRow) => ({
      id: v.id,
      violationType: v.violationType,
      message: v.message,
      facesCount: v.facesCount,
      snapshotUrl: v.snapshotUrl,
      meta: v.meta,
      createdAt: v.createdAt,
      examId: v.examId,
    })),
    total: violations.length,
  });
}
