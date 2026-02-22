import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/auth';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const id = Number((await params).id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });
  }
  const session = await prisma.session.findUnique({
    where: { id },
    include: {
      exam: { select: { id: true, code: true, name: true } },
      sessionClasses: { include: { class: { select: { id: true, code: true, name: true } } } },
    },
  });
  if (!session) return NextResponse.json({ error: 'Không tìm thấy ca thi' }, { status: 404 });

  const classIds = session.sessionClasses.map((sc) => sc.classId);
  const participatedByClass = await Promise.all(
    classIds.map(async (classId) => {
      const count = await prisma.sessionExaminee.count({
        where: {
          sessionId: id,
          examinee: { classes: { some: { classId } } },
        },
      });
      return { classId, count };
    })
  );
  const submittedByClass = await Promise.all(
    classIds.map(async (classId) => {
      const grouped = await prisma.submission.groupBy({
        by: ['examineeId'],
        where: {
          sessionId: id,
          examinee: { classes: { some: { classId } } },
        },
      });
      return { classId, count: grouped.length };
    })
  );
  const participatedMap = new Map(participatedByClass.map((p) => [p.classId, p.count]));
  const submittedMap = new Map(submittedByClass.map((s) => [s.classId, s.count]));

  const classes = session.sessionClasses.map((sc) => ({
    id: sc.class.id,
    code: sc.class.code,
    name: sc.class.name,
    countParticipated: participatedMap.get(sc.classId) ?? 0,
    countSubmitted: submittedMap.get(sc.classId) ?? 0,
  }));

  return NextResponse.json({
    session: {
      id: session.id,
      code: session.code,
      name: session.name,
      startAt: session.startAt,
      endAt: session.endAt,
      exam: session.exam,
    },
    classes,
  });
}
