import { NextRequest, NextResponse } from 'next/server';
import { verifyExaminee } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { uploadProctoringViolationSnapshot } from '@/lib/proctoringSnapshotUpload';
import type { Prisma } from '@prisma/client';

function envNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw.trim() === '') return fallback;
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

function getConfig() {
  return {
    serviceTimeoutMs: envNumber('PROCTORING_SERVICE_TIMEOUT_MS', 12_000),
    logoutAfterViolations: envNumber('PROCTORING_LOGOUT_AFTER_VIOLATIONS', 15),
  };
}

/** Số vi phạm trong “lượt” hiện tại + có cần đuổi không — dùng mọi response check, không chỉ khi frame này violation. */
async function getProctoringStrikeState(params: {
  sessionId: number;
  examineeId: number;
  strikeSinceMs?: number;
}): Promise<{ violationCount: number; forceLogout: boolean }> {
  const link = await prisma.sessionExaminee.findUnique({
    where: {
      sessionId_examineeId: { sessionId: params.sessionId, examineeId: params.examineeId },
    },
    select: { joinedAt: true },
  });
  const joinMs = link?.joinedAt?.getTime();
  const jwtMs = params.strikeSinceMs;
  const floors: number[] = [];
  if (typeof jwtMs === 'number' && Number.isFinite(jwtMs)) floors.push(jwtMs);
  if (typeof joinMs === 'number' && Number.isFinite(joinMs)) floors.push(joinMs);
  const since =
    floors.length > 0 ? new Date(Math.max(...floors)) : undefined;

  const violationCount = await prisma.proctoringViolation.count({
    where: {
      sessionId: params.sessionId,
      examineeId: params.examineeId,
      ...(since ? { createdAt: { gte: since } } : {}),
    },
  });
  const { logoutAfterViolations } = getConfig();
  return {
    violationCount,
    forceLogout: violationCount >= logoutAfterViolations,
  };
}

async function recordProctoringViolation(params: {
  sessionId: number;
  examineeId: number;
  violationType: string;
  message: string;
  facesCount?: number;
  meta?: Prisma.InputJsonValue;
  snapshotUrl?: string | null;
  /** Từ JWT — mốc “lượt” hiện tại; kết hợp joinedAt để token cũ vẫn đúng. */
  strikeSinceMs?: number;
}) {
  const sessionRow = await prisma.session.findUnique({
    where: { id: params.sessionId },
    select: { examId: true },
  });
  await prisma.proctoringViolation.create({
    data: {
      sessionId: params.sessionId,
      examId: sessionRow?.examId ?? null,
      examineeId: params.examineeId,
      violationType: params.violationType,
      message: params.message,
      facesCount: params.facesCount ?? null,
      snapshotUrl: params.snapshotUrl ?? null,
      meta: params.meta ?? undefined,
    },
  });

  return getProctoringStrikeState({
    sessionId: params.sessionId,
    examineeId: params.examineeId,
    strikeSinceMs: params.strikeSinceMs,
  });
}

export type ProctoringCheckResponse = {
  violation: boolean;
  type?: string;
  message: string;
  facesCount?: number;
  faces?: Array<{
    id?: number | string;
    theta: number;
    phi: number;
    bbox?: number[];
    dx_px?: number;
    dy_px?: number;
    direction?: string;
    looking_away?: boolean;
  }>;
  annotatedImageBase64?: string;
  enrolledStudentId?: string;
  violationCount?: number;
  forceLogout?: boolean;
  face?: {
    theta: number;
    phi: number;
    bbox?: number[];
    dx_px?: number;
    dy_px?: number;
  };
};

type GazeApiFace = {
  id?: number | string;
  theta: number;
  phi: number;
  bbox?: number[];
  dx?: number;
  dy?: number;
  dx_px?: number;
  dy_px?: number;
  direction?: string;
  looking_away?: boolean;
};
type GazeEstimateResponse = { faces?: GazeApiFace[] };
type GazeEstimateResponseWithImage = GazeEstimateResponse & {
  annotated_image_base64?: string | null;
  faces_count?: number;
  violation?: boolean;
  violation_type?: string;
  message?: string;
  enrolled_student_id?: string | null;
};

export async function POST(
  req: NextRequest
): Promise<NextResponse<ProctoringCheckResponse | { error: string }>> {
  const auth = await verifyExaminee();
  if (!auth) {
    return NextResponse.json({ error: 'Vui lòng đăng nhập thí sinh' }, { status: 401 });
  }
  if (auth.sessionId == null) {
    return NextResponse.json({ error: 'Bạn chưa vào ca thi' }, { status: 400 });
  }

  try {
    const body = await req.json();
    const imageBase64 = typeof body?.imageBase64 === 'string' ? body.imageBase64 : '';

    if (!imageBase64) {
      const strike = await recordProctoringViolation({
        sessionId: auth.sessionId,
        examineeId: auth.examineeId,
        violationType: 'no_frame',
        message: 'Không có ảnh từ camera.',
        facesCount: 0,
        strikeSinceMs: auth.strikeSinceMs,
      });
      return NextResponse.json({
        violation: true,
        type: 'no_frame',
        message: 'Không có ảnh từ camera.',
        facesCount: 0,
        faces: [],
        face: undefined,
        violationCount: strike.violationCount,
        forceLogout: strike.forceLogout,
      });
    }

    const serviceUrl = process.env.PROCTORING_SERVICE_URL;
    if (!serviceUrl) {
      return NextResponse.json(
        { error: 'Dịch vụ giám sát (Gaze API) chưa được cấu hình. Đặt PROCTORING_SERVICE_URL.' },
        { status: 503 }
      );
    }

    const examineeRow = await prisma.examinee.findUnique({
      where: { id: auth.examineeId },
      select: { mssv: true },
    });
    const studentId = examineeRow?.mssv?.trim() ?? '';

    const endpoint = `${serviceUrl.replace(/\/$/, '')}/gaze/estimate`;
    let res: Response;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), getConfig().serviceTimeoutMs);
      res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          image_base64: imageBase64,
          ...(studentId ? { student_id: studentId } : {}),
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timer));
    } catch (e) {
      const msg =
        e instanceof Error && (e.name === 'AbortError' || /aborted/i.test(e.message))
          ? 'Timeout gọi dịch vụ giám sát. Thử lại.'
          : 'Không kết nối được dịch vụ giám sát. Hãy chạy service và kiểm tra PROCTORING_SERVICE_URL.';
      return NextResponse.json({ error: msg }, { status: 503 });
    }

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { detail?: string };
      return NextResponse.json(
        { error: typeof err.detail === 'string' ? err.detail : 'Dịch vụ gaze tạm lỗi. Thử lại.' },
        { status: res.status >= 500 ? 503 : res.status }
      );
    }

    const data = (await res.json().catch(() => ({}))) as GazeEstimateResponseWithImage;
    const facesRaw = Array.isArray(data.faces) ? data.faces : [];
    /** Chỉ trim chuỗi; không ép MSSV từ JWT khi service chưa khớp định danh (id track số giữ nguyên). */
    const faces: GazeApiFace[] = facesRaw.map((f) =>
      typeof f.id === 'string' && f.id.trim() !== '' ? { ...f, id: f.id.trim() } : { ...f }
    );
    const face = faces[0];

    const annotatedImageBase64 =
      typeof data.annotated_image_base64 === 'string' ? data.annotated_image_base64 : undefined;
    const facesCount = typeof data.faces_count === 'number' ? data.faces_count : faces.length;
    const serviceMessage = typeof data.message === 'string' ? data.message : 'OK';
    const serviceType = typeof data.violation_type === 'string' ? data.violation_type : undefined;
    const serviceViolation = Boolean(data.violation);
    const enrolledFromService =
      typeof data.enrolled_student_id === 'string' ? data.enrolled_student_id.trim() : '';
    const enrolledStudentId = enrolledFromService || undefined;

    let violationCount: number | undefined;
    let forceLogout = false;
    if (serviceViolation) {
      const facesMeta = faces.map((f) => ({
        id: f.id,
        direction: f.direction,
        looking_away: f.looking_away,
        ...(typeof f.theta === 'number' ? { theta: f.theta } : {}),
        ...(typeof f.phi === 'number' ? { phi: f.phi } : {}),
      }));

      let snapshotUrl: string | null = null;
      const b64ForUpload = annotatedImageBase64?.trim() || imageBase64.trim();
      if (b64ForUpload) {
        snapshotUrl = await uploadProctoringViolationSnapshot(b64ForUpload, {
          sessionId: auth.sessionId,
          examineeId: auth.examineeId,
          violationIdHint: `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        });
      }

      const strike = await recordProctoringViolation({
        sessionId: auth.sessionId,
        examineeId: auth.examineeId,
        violationType: serviceType ?? 'unknown',
        message: serviceMessage,
        facesCount,
        snapshotUrl,
        meta: {
          enrolled_student_id: enrolledStudentId ?? null,
          faces: facesMeta,
        },
        strikeSinceMs: auth.strikeSinceMs,
      });
      violationCount = strike.violationCount;
      forceLogout = strike.forceLogout;
    } else {
      // Frame OK nhưng đã vượt ngưỡng lượt này — vẫn phải trả forceLogout để client đăng xuất ngay.
      const strike = await getProctoringStrikeState({
        sessionId: auth.sessionId,
        examineeId: auth.examineeId,
        strikeSinceMs: auth.strikeSinceMs,
      });
      violationCount = strike.violationCount;
      forceLogout = strike.forceLogout;
    }

    return NextResponse.json({
      violation: serviceViolation,
      type: serviceType,
      message: serviceMessage,
      facesCount,
      faces,
      face: face && typeof face.theta === 'number' && typeof face.phi === 'number' ? face : undefined,
      annotatedImageBase64,
      enrolledStudentId,
      violationCount,
      forceLogout,
    });
  } catch {
    return NextResponse.json({ error: 'Lỗi xử lý kiểm tra giám sát' }, { status: 500 });
  }
}
