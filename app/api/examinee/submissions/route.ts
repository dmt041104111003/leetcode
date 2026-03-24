import { NextResponse } from 'next/server';
import { verifyExaminee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET() {
  const auth = await verifyExaminee();
  if (!auth) {
    return NextResponse.json({ error: 'Vui lòng đăng nhập thí sinh' }, { status: 401 });
  }
  if (auth.sessionId == null) {
    return NextResponse.json({ submissions: [] });
  }

  const list = await prisma.submission.findMany({
    where: { sessionId: auth.sessionId, examineeId: auth.examineeId },
    orderBy: { submittedAt: 'desc' },
    select: { problemId: true, code: true, language: true, score: true, resultDetail: true, submittedAt: true },
  });

  const byProblem = new Map<number, (typeof list)[0]>();
  for (const s of list) {
    if (!byProblem.has(s.problemId)) byProblem.set(s.problemId, s);
  }

  const submissions = Array.from(byProblem.entries()).map(([problemId, s]) => ({
    problemId,
    code: s.code,
    language: s.language,
    score: s.score,
    resultDetail: s.resultDetail,
    submittedAt: s.submittedAt.toISOString(),
  }));

  return NextResponse.json({ submissions });
}
