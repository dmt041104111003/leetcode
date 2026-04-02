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
  const classIdParam = req.nextUrl.searchParams.get('classId');
  const classId = classIdParam ? Number(classIdParam) : null;
  if (Number.isNaN(sessionId)) {
    return NextResponse.json({ error: 'ID ca thi không hợp lệ' }, { status: 400 });
  }
  if (classId == null || Number.isNaN(classId)) {
    return NextResponse.json({ error: 'classId là bắt buộc' }, { status: 400 });
  }

  const session = await prisma.session.findUnique({
    where: { id: sessionId },
    select: { id: true },
  });
  if (!session) return NextResponse.json({ error: 'Không tìm thấy ca thi' }, { status: 404 });

  const classExaminees = await prisma.classExaminee.findMany({
    where: { classId },
    include: { examinee: { select: { id: true, mssv: true, fullName: true } } },
  });
  const examineeIds = classExaminees.map((ce) => ce.examineeId);

  const [sessionLinks, submittedGroup, violationGroup] = await Promise.all([
    prisma.sessionExaminee.findMany({
      where: { sessionId, examineeId: { in: examineeIds } },
      select: { examineeId: true, joinedAt: true },
    }),
    prisma.submission.groupBy({
      by: ['examineeId'],
      where: { sessionId, examineeId: { in: examineeIds } },
      _count: { _all: true },
    }),
    prisma.proctoringViolation.groupBy({
      by: ['examineeId'],
      where: { sessionId, examineeId: { in: examineeIds } },
      _count: { _all: true },
    }),
  ]);
  const linkByExaminee = new Map(sessionLinks.map((p) => [p.examineeId, p]));
  const submittedByExaminee = new Map(submittedGroup.map((s) => [s.examineeId, s._count._all]));
  const violationsByExaminee = new Map(violationGroup.map((v) => [v.examineeId, v._count._all]));

  const examinees = classExaminees.map((ce) => ({
    id: ce.examinee.id,
    mssv: ce.examinee.mssv,
    fullName: ce.examinee.fullName,
    participated: linkByExaminee.get(ce.examineeId)?.joinedAt != null,
    submitted: (submittedByExaminee.get(ce.examineeId) ?? 0) > 0,
    submissionCount: submittedByExaminee.get(ce.examineeId) ?? 0,
    violationCount: violationsByExaminee.get(ce.examineeId) ?? 0,
  }));

  return NextResponse.json({ examinees });
}
