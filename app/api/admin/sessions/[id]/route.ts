import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/auth';
import { hasOverlappingSessionForClasses } from '@/lib/sessionOverlap';
import { getErrorResponse } from '@/lib/apiError';

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
  const item = await prisma.session.findUnique({
    where: { id },
    include: {
      exam: { select: { id: true, code: true, name: true } },
      sessionClasses: { include: { class: { select: { id: true, code: true, name: true } } } },
    },
  });
  if (!item) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 });
  return NextResponse.json({ ...item, classes: item.sessionClasses.map((sc) => sc.class) });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const id = Number((await params).id);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });
  }
  try {
    const body = await req.json();
    const current = await prisma.session.findUnique({
      where: { id },
      select: { startAt: true, endAt: true, sessionClasses: { select: { classId: true } } },
    });
    if (!current) return NextResponse.json({ error: 'Không tìm thấy ca thi' }, { status: 404 });

    const data: Record<string, unknown> = {};
    if (body.code != null) data.code = String(body.code).trim();
    if (body.name != null) data.name = String(body.name).trim();
    if (body.startAt != null) data.startAt = new Date(body.startAt);
    if (body.endAt != null) data.endAt = new Date(body.endAt);
    if (body.examId !== undefined) data.examId = body.examId != null && body.examId !== '' ? Number(body.examId) : null;

    const startAt = (data.startAt as Date | undefined) ?? current.startAt;
    const endAt = (data.endAt as Date | undefined) ?? current.endAt;
    const classIds =
      body.classIds !== undefined ? parseClassIds(body.classIds) : current.sessionClasses.map((sc) => sc.classId);

    if (classIds.length > 0) {
      const others = await prisma.session.findMany({
        where: { sessionClasses: { some: {} } },
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
      if (hasOverlappingSessionForClasses(withClassIds, classIds, startAt, endAt, id)) {
        return NextResponse.json(
          { error: 'Một hoặc nhiều lớp đã được gán cho ca thi có khung giờ trùng hoặc giao nhau. Mỗi lớp không thể tham gia hai ca thi trùng/giao giờ.' },
          { status: 400 }
        );
      }
    }

    await prisma.session.update({
      where: { id },
      data: data as Parameters<typeof prisma.session.update>[0]['data'],
    });

    if (body.classIds !== undefined) {
      await prisma.sessionClass.deleteMany({ where: { sessionId: id } });
      if (classIds.length > 0) {
        await prisma.sessionClass.createMany({
          data: classIds.map((classId) => ({ sessionId: id, classId })),
        });
      }
      await prisma.sessionExaminee.deleteMany({ where: { sessionId: id } });
      if (classIds.length > 0) {
        const examineeIds = await prisma.classExaminee.findMany({
          where: { classId: { in: classIds } },
          select: { examineeId: true },
        });
        const unique = [...new Set(examineeIds.map((e) => e.examineeId))];
        if (unique.length > 0) {
          await prisma.sessionExaminee.createMany({
            data: unique.map((examineeId) => ({ sessionId: id, examineeId })),
            skipDuplicates: true,
          });
        }
      }
    }

    const updated = await prisma.session.findUnique({
      where: { id },
      include: {
        exam: { select: { id: true, code: true, name: true } },
        sessionClasses: { include: { class: { select: { id: true, code: true, name: true } } } },
      },
    });
    const classes = updated?.sessionClasses.map((sc) => sc.class) ?? [];
    return NextResponse.json({ ...updated, classes });
  } catch (e) {
    const { message, status } = getErrorResponse(e);
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(
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
  await prisma.session.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
