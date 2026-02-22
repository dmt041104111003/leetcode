import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdmin } from '@/lib/auth';

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; eid: string }> }
) {
  if (!(await verifyAdmin())) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const classId = Number((await params).id);
  const examineeId = Number((await params).eid);
  if (Number.isNaN(classId) || Number.isNaN(examineeId)) {
    return NextResponse.json({ error: 'ID không hợp lệ' }, { status: 400 });
  }
  await prisma.classExaminee.deleteMany({
    where: { classId, examineeId },
  });
  return NextResponse.json({ success: true });
}
