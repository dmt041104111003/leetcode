import { NextRequest, NextResponse } from 'next/server';
import { verifyExaminee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LANGUAGE_TO_ID, runJudge0Submission } from '@/lib/judge0';

const ACCEPTED_STATUS_ID = 3;

export async function POST(req: NextRequest) {
  const auth = await verifyExaminee();
  if (!auth) {
    return NextResponse.json({ error: 'Vui lòng đăng nhập thí sinh' }, { status: 401 });
  }
  if (auth.sessionId == null) {
    return NextResponse.json({ error: 'Bạn chưa vào ca thi. Vui lòng chọn ca thi trước khi nộp bài.' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const { problemId, code, language } = body;
    const pid = typeof problemId === 'number' ? problemId : parseInt(String(problemId), 10);
    if (Number.isNaN(pid) || pid < 1) {
      return NextResponse.json({ error: 'Câu hỏi không hợp lệ' }, { status: 400 });
    }
    if (typeof code !== 'string') {
      return NextResponse.json({ error: 'Thiếu bài làm (code)' }, { status: 400 });
    }
    const lang = typeof language === 'string' ? language.trim() || 'cpp' : 'cpp';
    const languageId = LANGUAGE_TO_ID[lang.toLowerCase()] ?? LANGUAGE_TO_ID.cpp;

    const session = await prisma.session.findUnique({
      where: { id: auth.sessionId },
      include: { exam: { include: { questions: { select: { problemId: true, points: true } } } } },
    });
    if (!session) {
      return NextResponse.json({ error: 'Ca thi không tồn tại' }, { status: 404 });
    }
    const now = new Date();
    if (now > session.endAt) {
      return NextResponse.json({ error: 'Đã hết giờ nộp bài' }, { status: 400 });
    }
    const examQuestions = session.exam?.questions ?? [];
    const problemIds = examQuestions.map((q: { problemId: number }) => q.problemId);
    if (!problemIds.includes(pid)) {
      return NextResponse.json({ error: 'Câu hỏi không thuộc ca thi này' }, { status: 400 });
    }
    const questionPoints = (examQuestions.find((q: { problemId: number; points: number | null }) => q.problemId === pid) as { points?: number | null } | undefined)?.points;
    const pointsForQuestion = typeof questionPoints === 'number' && questionPoints >= 0 ? questionPoints : 0;

    const problem = await prisma.problem.findUnique({
      where: { id: pid },
      include: { testCases: { orderBy: { sortOrder: 'asc' } } },
    });
    if (!problem) {
      return NextResponse.json({ error: 'Câu hỏi không tồn tại' }, { status: 404 });
    }

    const timeLimitSec = problem.timeLimitMs != null ? Math.max(1, Math.ceil(problem.timeLimitMs / 1000)) : 5;
    const memoryLimitKb = problem.memoryLimitMb != null ? problem.memoryLimitMb * 1024 : 128000;

    type Tc = { input: string; expectedOutput: string };
    let testCases: Tc[] = problem.testCases.map((tc: { input: string; expectedOutput: string }) => ({
      input: tc.input,
      expectedOutput: tc.expectedOutput,
    }));
    if (testCases.length === 0 && problem.examples != null && Array.isArray(problem.examples)) {
      const fromExamples: Tc[] = [];
      for (const ex of problem.examples as { input?: string; output?: string }[]) {
        const out = ex?.output;
        if (out != null && String(out).trim() !== '') {
          fromExamples.push({
            input: ex?.input != null ? String(ex.input) : '',
            expectedOutput: String(out),
          });
        }
      }
      if (fromExamples.length > 0) testCases = fromExamples;
    }
    let passed = 0;
    let withinTimeLimit = true;
    const results: { statusId: number; statusDesc: string; time?: string; memory?: number; passed: boolean }[] = [];

    for (const tc of testCases) {
      try {
        const expectedOutput = typeof tc.expectedOutput === 'string' ? tc.expectedOutput.trimEnd() : String(tc.expectedOutput ?? '').trimEnd();
        const result = await runJudge0Submission({
          source_code: code,
          language_id: languageId,
          stdin: tc.input,
          expected_output: expectedOutput || undefined,
          cpu_time_limit: timeLimitSec,
          memory_limit: memoryLimitKb,
        });
        const statusId = result.status?.id ?? 0;
        const statusDesc = result.status?.description ?? '';
        const accepted = statusId === ACCEPTED_STATUS_ID;
        if (accepted) passed++;
        const timeNum = result.time ? parseFloat(result.time) : 0;
        if (timeNum > timeLimitSec) withinTimeLimit = false;
        results.push({
          statusId,
          statusDesc,
          time: result.time ?? undefined,
          memory: result.memory ?? undefined,
          passed: accepted,
        });
      } catch (e) {
        withinTimeLimit = false;
        results.push({
          statusId: 13,
          statusDesc: 'Internal Error',
          passed: false,
        });
      }
    }

    const total = testCases.length;
    const testCasePercent = total > 0 ? (passed / total) * 70 : 0;
    const efficiencyPercent = total > 0 && withinTimeLimit ? 30 : 0;
    const passPercent = testCasePercent + efficiencyPercent; // 0–100
    const score =
      pointsForQuestion > 0 ? Math.round((pointsForQuestion * passPercent) / 100) : 0;

    const resultDetail = {
      passed,
      total,
      results,
      withinTimeLimit,
      testCasePercent: Math.round(testCasePercent),
      efficiencyPercent: Math.round(efficiencyPercent),
    };

    await prisma.submission.create({
      data: {
        sessionId: auth.sessionId,
        examineeId: auth.examineeId,
        problemId: pid,
        code,
        language: lang,
        status: 'graded',
        score,
        resultDetail: resultDetail as object,
      },
    });

    const message =
      total === 0
        ? 'Đã nộp bài. (Chưa có test case nào để chấm — cần thêm test case trong quản trị.)'
        : `Đã nộp bài. ${passed}/${total} test đúng, điểm: ${score} (70% test + 30% hiệu quả).`;

    return NextResponse.json({
      success: true,
      message,
      score,
      resultDetail,
    });
  } catch (e) {
    console.error('Submit error:', e);
    return NextResponse.json({ error: 'Lỗi khi lưu bài nộp. Vui lòng thử lại.' }, { status: 500 });
  }
}
