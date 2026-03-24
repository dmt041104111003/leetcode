import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/auth';
import { getErrorResponse } from '@/lib/apiError';
import { slugify } from '@/lib/slugify';

async function ensureUniqueSlug(baseSlug: string, excludeId?: number): Promise<string> {
  let slug = baseSlug || 'bai-tap';
  let n = 0;
  while (true) {
    const existing = await prisma.problem.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing || (excludeId != null && existing.id === excludeId)) return slug;
    n += 1;
    slug = `${baseSlug}-${n}`;
  }
}

export async function GET() {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const list = await prisma.problem.findMany({
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  return NextResponse.json(list);
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const body = await req.json();
    const { title, description, difficulty, constraints, examples, starterCode, timeLimitMs, memoryLimitMb, sortOrder, testCases } = body;
    if (!title || !description || !difficulty) {
      return NextResponse.json(
        { error: 'Vui lòng nhập đầy đủ: tiêu đề, mô tả, độ khó' },
        { status: 400 }
      );
    }
    const slug = await ensureUniqueSlug(slugify(String(title).trim()));
    const created = await prisma.problem.create({
      data: {
        slug,
        title: String(title).trim(),
        description: String(description),
        difficulty: String(difficulty),
        constraints: constraints != null ? String(constraints) : null,
        examples: examples != null ? (Array.isArray(examples) ? examples : null) : null,
        starterCode: starterCode != null && typeof starterCode === 'object' ? starterCode : null,
        timeLimitMs: timeLimitMs != null ? Number(timeLimitMs) : null,
        memoryLimitMb: memoryLimitMb != null ? Number(memoryLimitMb) : null,
        sortOrder: Number(sortOrder) ?? 0,
      },
    });
    const tcList = Array.isArray(testCases) ? testCases : [];
    if (tcList.length > 0) {
      await prisma.testCase.createMany({
        data: tcList.map((tc: { input?: string; expectedOutput?: string; isSample?: boolean; sortOrder?: number }, i: number) => ({
          problemId: created.id,
          input: typeof tc.input === 'string' ? tc.input : '',
          expectedOutput: typeof tc.expectedOutput === 'string' ? tc.expectedOutput : '',
          isSample: Boolean(tc.isSample),
          sortOrder: typeof tc.sortOrder === 'number' ? tc.sortOrder : i,
        })),
      });
    }
    const withCases = await prisma.problem.findUnique({
      where: { id: created.id },
      include: { testCases: true },
    });
    return NextResponse.json(withCases ?? created, { status: 201 });
  } catch (e) {
    const { message, status } = getErrorResponse(e);
    return NextResponse.json({ error: message }, { status });
  }
}
