'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import type { ExamineeInfo, SessionInfo, SessionStatus } from '../interfaces/session';
import ExamineeLoginForm from './ExamineeLoginForm';
import SessionCodePanel from './SessionCodePanel';
import { PROCTORING_FACE_ENROLLED_KEY } from '../hooks/useProctoring';
import { drawVideoMirroredLikePreview } from '../lib/mirrorVideoCapture';
import { EnrollDirectionGuide } from './EnrollDirectionGuide';

type ExamineeHomeProps = {
  examinee: ExamineeInfo | null;
};

const ENROLL_JPEG_QUALITY = 0.88;
const ENROLL_MAX_WIDTH = 640;
// Mỗi bước (1→3: chính diện, trái, phải); xong bước AI xác nhận thì nghỉ ngắn rồi sang bước kế.
const ENROLL_STEPS_TOTAL = 3;
// Chụp dày hơn một chút — nhiều frame là bình thường, vào thi nhanh hơn.
const TEMP_ENROLL_CAPTURE_INTERVAL_MS = 330;
/** Giới hạn khung hình cho một bước (đủ rộng để không hết giờ sớm). */
const TEMP_ENROLL_MAX_SAMPLES_PER_STEP = 55;
/** Giới hạn tổng khung (an toàn). */
const TEMP_ENROLL_MAX_SAMPLES_TOTAL = ENROLL_STEPS_TOTAL * TEMP_ENROLL_MAX_SAMPLES_PER_STEP + 30;
/** Nghỉ giữa hai bước trước khi thu hướng tiếp theo. */
const ENROLL_AUTO_NEXT_STEP_MS = 450;
/** Phải thu đủ số khung trong bước hiện tại mới được coi là xong bước (tránh nhảy / xong sớm). */
const ENROLL_MIN_FRAMES_PER_PHASE = 12;
/** Bước ngước/cúi (phase 3–4): tối thiểu mẫu gửi trước khi chấp nhận chuyển bước — khớp server (ít khung). */
const ENROLL_MIN_FRAMES_VERTICAL_PHASE = 3;

export default function ExamineeHome({ examinee }: ExamineeHomeProps) {
  const router = useRouter();
  const [mssv, setMssv] = useState('');
  const [fullName, setFullName] = useState('');
  const [sessionCode, setSessionCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);
  const [error, setError] = useState('');
  const [session, setSession] = useState<SessionInfo | null>(null);
  const [status, setStatus] = useState<SessionStatus | null>(null);

  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollError, setEnrollError] = useState('');
  const [enrollSubmitting, setEnrollSubmitting] = useState(false);
  const [enrollHint, setEnrollHint] = useState<string>('Giữ mặt chính diện.');
  const [enrollProgress, setEnrollProgress] = useState<{
    totalSent: number;
    maxTotal: number;
    activePhase: number;
    phaseSent: number;
    maxPerPhase: number;
    stepsDone: number;
    stepsTotal: number;
  } | null>(null);
  const enrollVideoRef = useRef<HTMLVideoElement | null>(null);
  const enrollStreamRef = useRef<MediaStream | null>(null);
  /** Giữa hai bước: tick xanh trên khối hướng dẫn mũi tên. */
  const [enrollBetweenSteps, setEnrollBetweenSteps] = useState(false);

  const stopEnrollCamera = useCallback(() => {
    enrollStreamRef.current?.getTracks().forEach((t) => t.stop());
    enrollStreamRef.current = null;
    if (enrollVideoRef.current) enrollVideoRef.current.srcObject = null;
  }, []);

  /** Reset histogram + bước enroll trên Gaze service (làm lại từ đầu khi chưa xong). Không gọi sau khi đã enroll thành công vào thi. */
  const resetIncompleteEnrollOnServer = useCallback(async () => {
    try {
      await fetch('/api/examinee/proctoring/reset', { method: 'POST' });
    } catch {
      /* best-effort */
    }
  }, []);

  useEffect(() => {
    if (!enrollOpen) {
      stopEnrollCamera();
      setEnrollHint('Giữ mặt chính diện.');
      setEnrollProgress(null);
      return;
    }
    let cancelled = false;
    setEnrollError('');
    setEnrollHint('Giữ mặt chính diện.');
    setEnrollProgress(null);
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        enrollStreamRef.current = stream;
        const el = enrollVideoRef.current;
        if (el) {
          el.srcObject = stream;
          await el.play().catch(() => {});
        }
      } catch {
        if (!cancelled) setEnrollError('Không mở được camera. Vui lòng cấp quyền.');
      }
    })();
    return () => {
      cancelled = true;
      stopEnrollCamera();
    };
  }, [enrollOpen, stopEnrollCamera]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/auth/examinee', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mssv: mssv.trim(), fullName: fullName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Đăng nhập thất bại');
        return;
      }
      router.refresh();
    } catch {
      setError('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    setLogoutLoading(true);
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.removeItem(PROCTORING_FACE_ENROLLED_KEY);
      }
      await fetch('/api/auth/examinee/logout', { method: 'POST' });
      router.refresh();
      setSession(null);
      setStatus(null);
      setSessionCode('');
    } catch {
      setError('Lỗi đăng xuất');
    } finally {
      setLogoutLoading(false);
    }
  };

  const joinSessionCookie = async (code: string): Promise<boolean> => {
    const res = await fetch('/api/auth/examinee/session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionCode: code }),
    });
    const data = await res.json();
    if (!res.ok) {
      setError(typeof data.error === 'string' ? data.error : 'Không thể vào ca thi');
      return false;
    }
    return true;
  };

  const handleSessionCode = async (e: React.FormEvent) => {
    e.preventDefault();
    const code = sessionCode.trim();
    if (!code) {
      setError('Vui lòng nhập mã ca thi');
      return;
    }
    setError('');
    setSession(null);
    setStatus(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/session-by-code?code=${encodeURIComponent(code)}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Mã ca thi không tồn tại');
        return;
      }
      setSession(data.session);
      setStatus(data.status);
    } catch {
      setError('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  /** Khi thí sinh đã đóng modal hoặc cần thử lại (ca đã active, cookie đã có hoặc chưa) */
  const handleStart = async () => {
    if (!session?.code) return;
    setLoading(true);
    setError('');
    try {
      const ok = await joinSessionCookie(session.code);
      if (ok) setEnrollOpen(true);
    } catch {
      setError('Lỗi kết nối');
    } finally {
      setLoading(false);
    }
  };

  const handleEnrollCapture = async () => {
    const v = enrollVideoRef.current;
    if (!v || v.readyState < 2 || v.videoWidth === 0) {
      setEnrollError('Camera chưa sẵn sàng. Chờ thêm một chút rồi thử lại.');
      return;
    }
    setEnrollError('');
    await resetIncompleteEnrollOnServer();
    setEnrollSubmitting(true);
    setEnrollProgress({
      totalSent: 0,
      maxTotal: TEMP_ENROLL_MAX_SAMPLES_TOTAL,
      activePhase: 1,
      phaseSent: 0,
      maxPerPhase: TEMP_ENROLL_MAX_SAMPLES_PER_STEP,
      stepsDone: 0,
      stepsTotal: ENROLL_STEPS_TOTAL,
    });
    try {
      const w = Math.min(v.videoWidth, ENROLL_MAX_WIDTH);
      const h = Math.round((v.videoHeight * w) / v.videoWidth);
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        setEnrollError('Không tạo được ảnh.');
        return;
      }
      const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
      let okAny = false;
      let lastErr: string | null = null;
      let totalSamples = 0;
      let success = false;
      type EnrollPayload = {
        enrolled?: boolean;
        pose_complete?: boolean;
        pose_missing?: string[];
        pose_coverage?: Record<string, boolean>;
        enroll_step_index?: number;
        enroll_step_total?: number;
        enroll_hint_vn?: string;
      };
      let lastOk: EnrollPayload | null = null;

      setEnrollHint(`Bước 1/${ENROLL_STEPS_TOTAL}: làm theo hướng dẫn bên dưới cho đến khi được xác nhận.`);

      phaseLoop: for (let phase = 0; phase < ENROLL_STEPS_TOTAL; phase++) {
        let phaseSamples = 0;
        let phaseAdvanced = false;
        const minFramesThisPhase = ENROLL_MIN_FRAMES_PER_PHASE;

        while (
          phaseSamples < TEMP_ENROLL_MAX_SAMPLES_PER_STEP &&
          totalSamples < TEMP_ENROLL_MAX_SAMPLES_TOTAL
        ) {
          if (!enrollVideoRef.current || enrollVideoRef.current.videoWidth === 0) break phaseLoop;

          drawVideoMirroredLikePreview(ctx, v, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', ENROLL_JPEG_QUALITY);
          const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

          const res = await fetch('/api/examinee/proctoring/enroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64 }),
          });
          const payload = (await res.json().catch(() => ({}))) as EnrollPayload & { error?: string };
          phaseSamples += 1;
          totalSamples += 1;

          const stepsTotal = Math.max(1, payload.enroll_step_total ?? ENROLL_STEPS_TOTAL);
          const stepIdxRaw = Math.max(0, Number(payload.enroll_step_index ?? 0));
          const stepsDone = Math.min(stepsTotal, stepIdxRaw);

          setEnrollProgress((p) =>
            p
              ? {
                  ...p,
                  totalSent: totalSamples,
                  activePhase: phase + 1,
                  phaseSent: phaseSamples,
                  stepsDone,
                  stepsTotal,
                }
              : null
          );

          if (res.ok) {
            lastOk = payload;
            if (payload.enrolled) okAny = true;
            const hint =
              typeof payload.enroll_hint_vn === 'string' && payload.enroll_hint_vn.trim()
                ? payload.enroll_hint_vn.trim()
                : '';
            if (hint) setEnrollHint(hint);
            else if ((payload.pose_missing?.length ?? 0) > 0) {
              setEnrollHint(`Bước ${phase + 1}/${ENROLL_STEPS_TOTAL}: còn lại — ${(payload.pose_missing ?? []).join(', ')}.`);
            }

            // Chỉ kết thúc khi đã ở bước cuối và đủ khung (tránh pose_complete / step nhảy sớm).
            if (
              payload.pose_complete &&
              okAny &&
              stepIdxRaw >= ENROLL_STEPS_TOTAL &&
              phase >= ENROLL_STEPS_TOTAL - 1 &&
              phaseSamples >= minFramesThisPhase
            ) {
              success = true;
              break phaseLoop;
            }
            // Server đã xác nhận bước `phase` chỉ khi chỉ số vượt phase **và** đã gửi đủ khung tại bước này.
            if (stepIdxRaw > phase && phaseSamples >= minFramesThisPhase) {
              phaseAdvanced = true;
              break;
            }
          } else {
            const err = payload.error;
            if (typeof err === 'string' && err.trim()) lastErr = err.trim();
          }

          await sleep(TEMP_ENROLL_CAPTURE_INTERVAL_MS);
        }

        if (success) break phaseLoop;

        if (!phaseAdvanced) {
          break phaseLoop;
        }

        if (phase >= ENROLL_STEPS_TOTAL - 1) {
          success = true;
          break phaseLoop;
        }

        setEnrollHint(
          `Đã xong bước ${phase + 1}/${ENROLL_STEPS_TOTAL}. Tự động chuyển sang bước ${phase + 2}/${ENROLL_STEPS_TOTAL} sau giây lát…`
        );
        setEnrollBetweenSteps(true);
        await sleep(ENROLL_AUTO_NEXT_STEP_MS);
        setEnrollBetweenSteps(false);
      }

      if (!success) {
        await resetIncompleteEnrollOnServer();
        if (!okAny) {
          setEnrollError(lastErr || 'Định danh khuôn mặt thất bại.');
          return;
        }
        const miss = lastOk?.pose_missing?.length
          ? `Còn thiếu: ${lastOk.pose_missing.join(', ')}.`
          : `Chưa xong bước ${(lastOk?.enroll_step_index ?? 0) + 1}/${ENROLL_STEPS_TOTAL} (AI gaze).`;
        setEnrollError(
          `Hết thời gian hoặc chưa đủ ổn định ở một bước. ${miss} Nhấn «Bắt đầu định danh» để thu lại từ đầu.`
        );
        return;
      }

      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem(PROCTORING_FACE_ENROLLED_KEY, '1');
      }
      stopEnrollCamera();
      setEnrollOpen(false);
      router.replace('/examinee/exam');
    } catch {
      await resetIncompleteEnrollOnServer();
      setEnrollError('Lỗi khi gửi ảnh định danh.');
    } finally {
      setEnrollBetweenSteps(false);
      setEnrollSubmitting(false);
      setEnrollProgress(null);
    }
  };

  const closeEnrollModal = () => {
    setEnrollBetweenSteps(false);
    void resetIncompleteEnrollOnServer();
    setEnrollOpen(false);
    setEnrollError('');
    stopEnrollCamera();
  };

  if (!examinee) {
    return (
      <ExamineeLoginForm
        mssv={mssv}
        fullName={fullName}
        loading={loading}
        error={error}
        onMssvChange={setMssv}
        onFullNameChange={setFullName}
        onErrorClear={() => setError('')}
        onSubmit={handleLogin}
      />
    );
  }

  return (
    <>
      <SessionCodePanel
        examinee={examinee}
        sessionCode={sessionCode}
        session={session}
        status={status}
        loading={loading}
        logoutLoading={logoutLoading}
        error={error}
        onSessionCodeChange={(v) => {
          setSessionCode(v);
          setError('');
          setSession(null);
          setStatus(null);
        }}
        onSessionSubmit={handleSessionCode}
        onLogout={handleLogout}
        onStart={handleStart}
      />

      {enrollOpen && (
        <div
          className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 p-3 sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Chụp ảnh định danh"
        >
          <div className="flex max-h-[92vh] w-full max-w-lg flex-col overflow-hidden rounded-xl bg-white shadow-xl dark:bg-gray-900 sm:max-w-xl">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              <div className="space-y-3 p-4 sm:space-y-4 sm:p-5">
                <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100 sm:text-lg">Định danh khuôn mặt</h2>
                <div className="rounded-lg border border-blue-200 bg-blue-50 px-2.5 py-2 text-xs text-blue-800 sm:text-sm">
                  <p className="font-medium leading-snug">{enrollHint}</p>
                </div>
                <div className="relative mx-auto w-full overflow-hidden rounded-xl border-2 border-gray-300 bg-black shadow-lg">
                  <div className="aspect-video w-full max-h-[min(48vh,340px)]">
                    <video
                      ref={enrollVideoRef}
                      autoPlay
                      playsInline
                      muted
                      className="h-full w-full object-cover"
                      style={{ transform: 'scaleX(-1)' }}
                    />
                  </div>
                  <EnrollDirectionGuide
                    variant="overlay"
                    activePhase={enrollSubmitting ? (enrollProgress?.activePhase ?? 1) : 0}
                    betweenSteps={enrollBetweenSteps}
                  />
                </div>
                {(enrollError || error) && (
                  <p className="text-xs leading-snug text-red-600 sm:text-sm">{enrollError || error}</p>
                )}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/80">
              <button
                type="button"
                onClick={closeEnrollModal}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-gray-800"
                disabled={enrollSubmitting}
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={() => void handleEnrollCapture()}
                disabled={enrollSubmitting}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-700 disabled:opacity-50"
              >
                {enrollSubmitting ? 'Đang thu mẫu...' : 'Bắt đầu định danh'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
