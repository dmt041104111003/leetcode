import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/auth';
import { getErrorResponse } from '@/lib/apiError';

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
  const item = await prisma.exam.findUnique({
    where: { id },
    include: { questions: { include: { problem: true }, orderBy: [{ sortOrder: 'asc' }] } },
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
    if (body.code != null) data.code = String(body.code).trim();
    if (body.name != null) data.name = String(body.name).trim();
    if (body.description !== undefined) data.description = body.description != null ? String(body.description).trim() || null : null;
    const updated = await prisma.exam.update({
      where: { id },
      data: data as Parameters<typeof prisma.exam.update>[0]['data'],
    });
    return NextResponse.json(updated);
  } catch (e: unknown) {
    const prismaError = e as { code?: string };
    if (prismaError.code === 'P2002') {
      return NextResponse.json(
        { error: 'Mã đề thi đã tồn tại. Vui lòng chọn mã khác.' },
        { status: 400 }
      );
    }
    if (prismaError.code === 'P2025') {
      return NextResponse.json({ error: 'Không tìm thấy đề thi' }, { status: 404 });
    }
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
    await prisma.exam.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const prismaError = e as { code?: string };
    if (prismaError.code === 'P2003') {
      return NextResponse.json(
        { error: 'Không thể xóa đề thi đang được gán cho ca thi. Vui lòng xóa ca thi hoặc bỏ chọn đề thi khỏi ca thi trước.' },
        { status: 400 }
      );
    }
    const { message, status } = getErrorResponse(e);
    return NextResponse.json({ error: message }, { status });
  }
}
