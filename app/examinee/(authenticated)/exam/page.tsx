import { redirect } from 'next/navigation';
import { verifyExaminee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import ExamClient from '../../components/ExamClient';

export default async function ExamineeExamPage() {
  const auth = await verifyExaminee();
  if (!auth) redirect('/');

  const session = auth.sessionId
    ? await prisma.session.findUnique({
        where: { id: auth.sessionId },
        include: {
          exam: {
            include: {
              questions: {
                orderBy: { sortOrder: 'asc' },
                include: {
                  problem: {
                    include: {
                      testCases: { orderBy: { sortOrder: 'asc' } },
                    },
                  },
                },
              },
            },
          },
        },
      })
    : null;

  const examinee = await prisma.examinee.findUnique({
    where: { id: auth.examineeId },
  });

  if (!session) {
    return (
      <main className="min-h-screen p-6 flex flex-col items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="max-w-md w-full bg-white dark:bg-gray-800 rounded-lg shadow p-6">
          <h1 className="text-xl font-semibold mb-2">Chưa chọn ca thi</h1>
          <p className="text-gray-600 dark:text-gray-400">Vui lòng đăng nhập và chọn ca thi.</p>
        </div>
      </main>
    );
  }

  const exam = session.exam;
  const questions =
    exam?.questions.map((q: { problem: { id: number; title: string; slug: string; description: string; difficulty: string; constraints: string | null; examples: unknown; starterCode: unknown; testCases?: { id: number; input: string; expectedOutput: string; isSample: boolean }[] }; sortOrder: number; points: number | null }) => ({
      id: q.problem.id,
      sortOrder: q.sortOrder,
      points: q.points,
      title: q.problem.title,
      slug: q.problem.slug,
      description: q.problem.description,
      difficulty: q.problem.difficulty,
      constraints: q.problem.constraints,
      examples: q.problem.examples,
      starterCode: q.problem.starterCode,
      testCases: (q.problem.testCases ?? []).map((tc: { id: number; input: string; expectedOutput: string; isSample: boolean }) => ({
        id: tc.id,
        input: tc.input,
        expectedOutput: tc.expectedOutput,
        isSample: tc.isSample,
      })),
    })) ?? [];

  return (
    <ExamClient
      sessionName={session.name}
      sessionCode={session.code}
      endAt={session.endAt.toISOString()}
      examineeName={examinee?.fullName ?? examinee?.mssv ?? ''}
      questions={questions}
    />
  );
}
