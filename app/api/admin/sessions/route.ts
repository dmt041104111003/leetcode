import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/auth';
import { hasOverlappingSessionForClasses } from '@/lib/sessionOverlap';
import { getErrorResponse } from '@/lib/apiError';

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const list = await prisma.session.findMany({
    orderBy: [{ id: 'asc' }],
    include: {
      exam: { select: { id: true, code: true, name: true } },
      sessionClasses: { include: { class: { select: { id: true, code: true, name: true } } } },
    },
  });
  const mapped = list.map((s) => ({
    ...s,
    classes: s.sessionClasses.map((sc) => sc.class),
  }));
  return NextResponse.json(mapped);
}

function parseClassIds(bodyClassIds: unknown): number[] {
  if (Array.isArray(bodyClassIds)) {
    return bodyClassIds.filter((x): x is number => typeof x === 'number' && Number.isInteger(x) && x > 0);
  }
  if (bodyClassIds != null && bodyClassIds !== '') {
    const n = Number(bodyClassIds);
    if (Number.isInteger(n) && n > 0) return [n];
  }
  return [];
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { code, name, startAt, endAt, examId, classIds: bodyClassIds } = body;
    if (!code || !name || !startAt || !endAt) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đầy đủ: mã ca thi, tên, thời gian bắt đầu, kết thúc' },
        { status: 400 }
      );
    }
    const start = new Date(startAt);
    const end = new Date(endAt);
    const classIds = parseClassIds(bodyClassIds);

    if (classIds.length > 0) {
      const now = new Date();
      const others = await prisma.session.findMany({
        where: { sessionClasses: { some: {} }, endAt: { gte: now } },
        select: {
          id: true,
          startAt: true,
          endAt: true,
          sessionClasses: { select: { classId: true } },
        },
      });
      const withClassIds = others.map((s) => ({
        id: s.id,
        startAt: s.startAt,
        endAt: s.endAt,
        classIds: s.sessionClasses.map((sc) => sc.classId),
      }));
      if (hasOverlappingSessionForClasses(withClassIds, classIds, start, end)) {
        return NextResponse.json(
          { error: 'Một hoặc nhiều lớp đã được gán cho ca thi có khung giờ trùng hoặc giao nhau. Mỗi lớp không thể tham gia hai ca thi trùng/giao giờ.' },
          { status: 400 }
        );
      }
    }

    const created = await prisma.session.create({
      data: {
        code: String(code).trim(),
        name: String(name).trim(),
        startAt: start,
        endAt: end,
        examId: examId != null && examId !== '' ? Number(examId) : null,
        sessionClasses: classIds.length > 0 ? { create: classIds.map((classId) => ({ classId })) } : undefined,
      },
      include: {
        exam: { select: { id: true, code: true, name: true } },
        sessionClasses: { include: { class: { select: { id: true, code: true, name: true } } } },
      },
    });
    const classes = created.sessionClasses.map((sc) => sc.class);
    if (classIds.length > 0) {
      const examineeIds = await prisma.classExaminee.findMany({
        where: { classId: { in: classIds } },
        select: { examineeId: true },
      });
      const unique = [...new Set(examineeIds.map((e) => e.examineeId))];
      if (unique.length > 0) {
        await prisma.sessionExaminee.createMany({
          data: unique.map((examineeId) => ({ sessionId: created.id, examineeId })),
          skipDuplicates: true,
        });
      }
    }
    return NextResponse.json({ ...created, classes }, { status: 201 });
  } catch (e) {
    const { message, status } = getErrorResponse(e);
    return NextResponse.json({ error: message }, { status });
  }
}
