import { NextRequest, NextResponse } from 'next/server';
import { verifyExaminee } from '@/lib/auth';

const MAX_GAZE_H_DEG = 28;
const MAX_GAZE_V_DEG = 28;
const DIRECTION_THRESHOLD_DEG = 6;
const RAD_TO_DEG = 180 / Math.PI;

export type GazeDirectionLabel =
  | 'Chính diện'
  | 'Nhìn trái'
  | 'Nhìn phải'
  | 'Nhìn lên'
  | 'Nhìn xuống'
  | 'Nhìn trái lên'
  | 'Nhìn trái xuống'
  | 'Nhìn phải lên'
  | 'Nhìn phải xuống';

export type ProctoringCheckResponse = {
  violation: boolean;
  message: string;
  gazeDirection: GazeDirectionLabel;
};

type GazeApiFace = { theta: number; phi: number };
type GazeEstimateResponse = { faces?: GazeApiFace[] };

function gazeRadToDeg(thetaRad: number, phiRad: number): { horizontalDeg: number; verticalDeg: number } {
  const horizontalDeg = phiRad * RAD_TO_DEG;
  const verticalDeg = thetaRad * RAD_TO_DEG;
  return { horizontalDeg, verticalDeg };
}

function getGazeDirectionLabel(horizontalDeg: number, verticalDeg: number): GazeDirectionLabel {
  const t = DIRECTION_THRESHOLD_DEG;
  const left = horizontalDeg < -t;
  const right = horizontalDeg > t;
  const up = verticalDeg > t;
  const down = verticalDeg < -t;
  if (!left && !right && !up && !down) return 'Chính diện';
  if (left && up) return 'Nhìn trái lên';
  if (left && down) return 'Nhìn trái xuống';
  if (left) return 'Nhìn trái';
  if (right && up) return 'Nhìn phải lên';
  if (right && down) return 'Nhìn phải xuống';
  if (right) return 'Nhìn phải';
  if (up) return 'Nhìn lên';
  if (down) return 'Nhìn xuống';
  return 'Chính diện';
}

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
      return NextResponse.json({
        violation: true,
        type: 'no_frame',
        message: 'Không có ảnh từ camera.',
        gazeDirection: 'Chính diện',
      });
    }

    const serviceUrl = process.env.PROCTORING_SERVICE_URL;
    if (!serviceUrl) {
      return NextResponse.json(
        { error: 'Dịch vụ giám sát (Gaze API) chưa được cấu hình. Đặt PROCTORING_SERVICE_URL.' },
        { status: 503 }
      );
    }

    const res = await fetch(`${serviceUrl.replace(/\/$/, '')}/gaze/estimate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image_base64: imageBase64 }),
    });

    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { detail?: string };
      return NextResponse.json(
        { error: typeof err.detail === 'string' ? err.detail : 'Dịch vụ gaze tạm lỗi. Thử lại.' },
        { status: res.status >= 500 ? 503 : res.status }
      );
    }

    const data = (await res.json().catch(() => ({}))) as GazeEstimateResponse;
    const faces = Array.isArray(data.faces) ? data.faces : [];
    const face = faces[0];

    if (!face || typeof face.theta !== 'number' || typeof face.phi !== 'number') {
      return NextResponse.json({
        violation: true,
        type: 'no_face',
        message: 'Không nhận diện được khuôn mặt. Nhìn thẳng vào camera.',
        gazeDirection: 'Chính diện',
      });
    }

    const { horizontalDeg, verticalDeg } = gazeRadToDeg(face.theta, face.phi);
    const gazeDirection = getGazeDirectionLabel(horizontalDeg, verticalDeg);
    const lookingAway =
      Math.abs(horizontalDeg) > MAX_GAZE_H_DEG || Math.abs(verticalDeg) > MAX_GAZE_V_DEG;

    if (lookingAway) {
      return NextResponse.json({
        violation: true,
        type: 'looking_away',
        message: `${gazeDirection}. Nhìn thẳng vào camera.`,
        gazeDirection,
      });
    }

    return NextResponse.json({
      violation: false,
      message: gazeDirection,
      gazeDirection,
    });
  } catch {
    return NextResponse.json(
      { error: 'Lỗi xử lý kiểm tra giám sát' },
      { status: 500 }
    );
  }
}
