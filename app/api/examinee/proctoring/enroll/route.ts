import { NextRequest, NextResponse } from 'next/server';
import { verifyExaminee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

type EnrollResponse = {
  enrolled: boolean;
  student_id?: string | null;
  detail?: string;
  pitch_rad?: number | null;
  yaw_rad?: number | null;
  pose_coverage?: Record<string, boolean>;
  pose_complete?: boolean;
  pose_missing?: string[];
  enroll_step_index?: number;
  enroll_step_total?: number;
  enroll_target_key?: string | null;
  enroll_hint_vn?: string;
};

export async function POST(req: NextRequest): Promise<NextResponse<EnrollResponse | { error: string }>> {
  const auth = await verifyExaminee();
  if (!auth) {
    return NextResponse.json({ error: 'Vui lòng đăng nhập thí sinh' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const imageBase64 = typeof body?.imageBase64 === 'string' ? body.imageBase64 : '';
    if (!imageBase64) {
      return NextResponse.json({ error: 'Không có ảnh từ camera.' }, { status: 400 });
    }

    // student_id gửi sang service = MSSV (trường "mã sinh viên" lúc đăng nhập), không dùng examineeId.
    const examinee = await prisma.examinee.findUnique({
      where: { id: auth.examineeId },
      select: { mssv: true },
    });
    const studentId = examinee?.mssv?.trim() ?? '';
    if (!studentId) {
      return NextResponse.json({ error: 'Không tìm thấy MSSV thí sinh' }, { status: 500 });
    }

    const serviceUrl = process.env.PROCTORING_SERVICE_URL;
    if (!serviceUrl) {
      return NextResponse.json(
        { error: 'Dịch vụ giám sát (Gaze API) chưa được cấu hình. Đặt PROCTORING_SERVICE_URL.' },
        { status: 503 }
      );
    }

    const res = await fetch(`${serviceUrl.replace(/\/$/, '')}/proctoring/enroll`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ student_id: studentId, image_base64: imageBase64 }),
    });

    const data = (await res.json().catch(() => ({}))) as EnrollResponse & { detail?: string; error?: string };
    if (!res.ok) {
      return NextResponse.json(
        { error: typeof (data as any).detail === 'string' ? (data as any).detail : 'Không enroll được' },
        { status: res.status >= 500 ? 503 : res.status }
      );
    }

    // Service có thể trả enrolled=false (không thấy mặt khung này) nhưng vẫn có pose_coverage / pose_missing — client cần để lặp.
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: 'Lỗi xử lý enroll' }, { status: 500 });
  }
}

