import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/auth';
import { slugify } from '@/lib/slugify';
import { getErrorResponse } from '@/lib/apiError';

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
  const item = await prisma.problem.findUnique({
    where: { id },
    include: { testCases: true },
  });
  if (!item) return NextResponse.json({ error: 'Không tìm thấy' }, { status: 404 });
  return NextResponse.json(item);
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
    const data: Record<string, unknown> = {};
    if (body.title != null) {
      data.title = String(body.title).trim();
      data.slug = await ensureUniqueSlug(slugify(String(body.title).trim()), id);
    }
    if (body.description != null) data.description = String(body.description);
    if (body.difficulty != null) data.difficulty = String(body.difficulty);
    if (body.constraints !== undefined) data.constraints = body.constraints != null ? String(body.constraints) : null;
    if (body.examples !== undefined) data.examples = Array.isArray(body.examples) ? body.examples : null;
    if (body.starterCode !== undefined) data.starterCode = body.starterCode != null && typeof body.starterCode === 'object' ? body.starterCode : null;
    if (body.timeLimitMs !== undefined) data.timeLimitMs = body.timeLimitMs != null ? Number(body.timeLimitMs) : null;
    if (body.memoryLimitMb !== undefined) data.memoryLimitMb = body.memoryLimitMb != null ? Number(body.memoryLimitMb) : null;
    if (body.sortOrder !== undefined) data.sortOrder = Number(body.sortOrder) ?? 0;
    const updated = await prisma.problem.update({
      where: { id },
      data: data as Parameters<typeof prisma.problem.update>[0]['data'],
    });
    if (body.testCases !== undefined && Array.isArray(body.testCases)) {
      await prisma.testCase.deleteMany({ where: { problemId: id } });
      const tcList = body.testCases as { input?: string; expectedOutput?: string; isSample?: boolean; sortOrder?: number }[];
      if (tcList.length > 0) {
        await prisma.testCase.createMany({
          data: tcList.map((tc, i) => ({
            problemId: id,
            input: typeof tc.input === 'string' ? tc.input : '',
            expectedOutput: typeof tc.expectedOutput === 'string' ? tc.expectedOutput : '',
            isSample: Boolean(tc.isSample),
            sortOrder: typeof tc.sortOrder === 'number' ? tc.sortOrder : i,
          })),
        });
      }
    }
    const withCases = await prisma.problem.findUnique({
      where: { id },
      include: { testCases: { orderBy: { sortOrder: 'asc' } } },
    });
    return NextResponse.json(withCases ?? updated);
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
  try {
    await prisma.problem.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const prismaError = e as { code?: string };
    if (prismaError.code === 'P2003') {
      return NextResponse.json(
        { error: 'Không thể xóa câu hỏi đang nằm trong đề thi. Vui lòng xóa đề thi chứa câu hỏi này hoặc bỏ câu hỏi khỏi đề thi trước.' },
        { status: 400 }
      );
    }
    const { message, status } = getErrorResponse(e);
    return NextResponse.json({ error: message }, { status });
  }
}
