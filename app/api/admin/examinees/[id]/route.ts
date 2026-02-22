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
  const item = await prisma.examinee.findUnique({ where: { id } });
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
    if (body.mssv != null) data.mssv = String(body.mssv).trim();
    if (body.fullName !== undefined) data.fullName = body.fullName != null ? String(body.fullName).trim() || null : null;
    const updated = await prisma.examinee.update({
      where: { id },
      data: data as Parameters<typeof prisma.examinee.update>[0]['data'],
    });
    return NextResponse.json(updated);
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
    await prisma.examinee.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e: unknown) {
    const prismaError = e as { code?: string };
    if (prismaError.code === 'P2003') {
      return NextResponse.json(
        { error: 'Không thể xóa thí sinh đang thuộc lớp. Vui lòng xóa lớp hoặc bỏ thí sinh khỏi lớp trước.' },
        { status: 400 }
      );
    }
    const { message, status } = getErrorResponse(e);
    return NextResponse.json({ error: message }, { status });
  }
}
