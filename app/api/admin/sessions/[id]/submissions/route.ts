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
  const examineeId = examineeIdParam ? Number(examineeIdParam) : null;
  if (Number.isNaN(sessionId)) {
    return NextResponse.json({ error: 'ID ca thi không hợp lệ' }, { status: 400 });
  }
  if (examineeId == null || Number.isNaN(examineeId)) {
    return NextResponse.json({ error: 'examineeId là bắt buộc' }, { status: 400 });
  }

  const submissions = await prisma.submission.findMany({
    where: { sessionId, examineeId },
    include: {
      problem: { select: { id: true, title: true, slug: true } },
    },
    orderBy: { problemId: 'asc' },
  });

  const examinee = await prisma.examinee.findUnique({
    where: { id: examineeId },
    select: { id: true, mssv: true, fullName: true },
  });
  if (!examinee) return NextResponse.json({ error: 'Không tìm thấy thí sinh' }, { status: 404 });

  const items = submissions.map((s) => ({
    id: s.id,
    problemId: s.problemId,
    problemTitle: s.problem?.title ?? '',
    problemSlug: s.problem?.slug ?? '',
    score: s.score,
    submittedAt: s.submittedAt,
    code: s.code,
    language: s.language,
  }));

  return NextResponse.json({ examinee, submissions: items });
}
