'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { drawVideoMirroredLikePreview } from '../lib/mirrorVideoCapture';

/** Dữ liệu vi phạm; UI popup chỉ hiển thị ảnh (không dùng message/MSSV trên khung vàng). */
export type ViolationInfo =
  | {
      type: string;
      message: string;
      facesCount?: number;
      enrolledStudentId?: string;
      faces?: Array<{
        id?: number | string;
        theta?: number;
        phi?: number;
        direction?: string;
        lookingAway?: boolean;
      }>;
      snapshotDataUrl?: string;
    }
  | null;

export type GazeResult = string | null;
export type ProctoringStatus = 'idle' | 'checking';

export type ProctoringFaceOverlay = {
  theta: number;
  phi: number;
  bbox?: number[];
  dxPx?: number;
  dyPx?: number;
  frameW: number;
  frameH: number;
  ts: number;
};

const CAPTURE_INTERVAL_MS = (() => {
  const raw = process.env.NEXT_PUBLIC_PROCTORING_CAPTURE_INTERVAL_MS;
  const n = raw != null ? Number(raw) : NaN;
  // Default faster to feel realtime, but still reasonable load.
  return Number.isFinite(n) && n >= 200 ? n : 500;
})();
const JPEG_QUALITY = 0.85;
const MAX_WIDTH = 640;
const CHECK_TIMEOUT_MS = 12_000;
const SNAPSHOT_TTL_MS = 8_000;
/** Đặt sau khi chụp ảnh định danh ở màn hình vào ca; bỏ qua enroll lặp lại trong phiên thi. */
export const PROCTORING_FACE_ENROLLED_KEY = 'proctoring_face_enrolled';

export type UseProctoringOptions = {
  /** Gọi khi tổng số vi phạm trong ca thi vượt ngưỡng (mặc định 15) — nên đăng xuất + điều hướng. */
  onStrikeout?: () => void | Promise<void>;
};

export function useProctoring(enabled: boolean, options?: UseProctoringOptions) {
  const strikeoutRef = useRef(options?.onStrikeout);
  strikeoutRef.current = options?.onStrikeout;

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingCheckRef = useRef(false);
  const violationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const enrolledRef = useRef(false);
  const lastViolationPopupCountRef = useRef(0);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState<ProctoringStatus>('idle');
  const [violation, setViolation] = useState<ViolationInfo>(null);
  const [gazeResult, setGazeResult] = useState<GazeResult>(null);
  const [error, setError] = useState<string | null>(null);
  const [faceOverlay, setFaceOverlay] = useState<ProctoringFaceOverlay | null>(null);

  const clearViolation = useCallback(() => {
    if (violationTimeoutRef.current) {
      clearTimeout(violationTimeoutRef.current);
      violationTimeoutRef.current = null;
    }
    setViolation(null);
  }, []);

  useEffect(() => {
    if (!enabled) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setStream(null);
      setActive(false);
      setStatus('idle');
      setError(null);
      setGazeResult(null);
      setViolation(null);
      setFaceOverlay(null);
      clearViolation();
      enrolledRef.current = false;
      lastViolationPopupCountRef.current = 0;
      return;
    }

    let cancelled = false;

    (async () => {
      setError(null);
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
          audio: false,
        });

        if (cancelled) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }

        streamRef.current = mediaStream;
        setStream(mediaStream);
        setActive(true);

        const canvas = document.createElement('canvas');

        /** Đồng bộ histogram lên Gaze service (bắt buộc ít nhất 1 lần mỗi phiên proctoring).
         *  Không được bỏ qua chỉ vì sessionStorage: restart service / worker khác làm mất bộ nhớ → không gán MSSV. */
        const enrollOnce = async () => {
          if (enrolledRef.current) return;
          const v = videoRef.current;
          const s = streamRef.current;
          if (!v || !s || v.readyState !== 4 || v.videoWidth === 0) return;

          const w = Math.min(v.videoWidth, MAX_WIDTH);
          const h = Math.round((v.videoHeight * w) / v.videoWidth);
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) return;
          drawVideoMirroredLikePreview(ctx, v, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

          const res = await fetch('/api/examinee/proctoring/enroll', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: base64 }),
          });
          if (res.ok) enrolledRef.current = true;
        };

        const check = async () => {
          if (pendingCheckRef.current) return;
          await enrollOnce();
          const v = videoRef.current;
          const s = streamRef.current;
          if (!v || !s || v.readyState !== 4 || v.videoWidth === 0) return;

          pendingCheckRef.current = true;
          setStatus('checking');

          try {
            const w = Math.min(v.videoWidth, MAX_WIDTH);
            const h = Math.round((v.videoHeight * w) / v.videoWidth);
            canvas.width = w;
            canvas.height = h;

            const ctx = canvas.getContext('2d');
            if (!ctx) return;

            drawVideoMirroredLikePreview(ctx, v, w, h);
            const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
            const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);
            const res = await fetch('/api/examinee/proctoring/check', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: base64 }),
              signal: controller.signal,
              credentials: 'same-origin',
            }).finally(() => clearTimeout(timer));

            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
              const msg =
                typeof (data as { error?: string }).error === 'string'
                  ? (data as { error: string }).error
                  : `Lỗi giám sát (${res.status})`;
              setError(msg);
              setGazeResult(null);
              setFaceOverlay(null);
              return;
            }

            if ((data as { forceLogout?: unknown }).forceLogout === true) {
              try {
                await strikeoutRef.current?.();
              } finally {
                if (typeof window !== 'undefined') {
                  window.location.assign('/');
                }
              }
              return;
            }

            const message = typeof (data as { message?: string }).message === 'string' ? data.message : '';
            setGazeResult(message || null);
            setError(null);

            const face = (data as { face?: unknown }).face;
            if (face && typeof face === 'object') {
              const f = face as {
                theta?: unknown;
                phi?: unknown;
                bbox?: unknown;
                dx_px?: unknown;
                dy_px?: unknown;
              };
              if (typeof f.theta === 'number' && typeof f.phi === 'number') {
                setFaceOverlay({
                  theta: f.theta,
                  phi: f.phi,
                  bbox: Array.isArray(f.bbox) ? (f.bbox as number[]) : undefined,
                  dxPx: typeof f.dx_px === 'number' ? f.dx_px : undefined,
                  dyPx: typeof f.dy_px === 'number' ? f.dy_px : undefined,
                  frameW: w,
                  frameH: h,
                  ts: Date.now(),
                });
              } else {
                setFaceOverlay(null);
              }
            } else {
              setFaceOverlay(null);
            }

            if ((data as { violation?: boolean }).violation) {
              const vcRaw = (data as { violationCount?: unknown }).violationCount;
              const vc =
                typeof vcRaw === 'number' && Number.isFinite(vcRaw) ? vcRaw : null;
              if (vc != null && vc <= lastViolationPopupCountRef.current) {
                // Đã popup cho mức đếm này.
              } else {
                if (vc != null) lastViolationPopupCountRef.current = vc;
                const annotatedB64 =
                  typeof (data as { annotatedImageBase64?: unknown }).annotatedImageBase64 === 'string'
                    ? (data as { annotatedImageBase64: string }).annotatedImageBase64
                    : '';
                const snapWithOverlay = annotatedB64
                  ? `data:image/jpeg;base64,${annotatedB64}`
                  : dataUrl;
                const enrolledSid =
                  typeof (data as { enrolledStudentId?: unknown }).enrolledStudentId === 'string'
                    ? (data as { enrolledStudentId: string }).enrolledStudentId.trim()
                    : '';
                setViolation({
                  type: (data as { type?: string }).type ?? 'violation',
                  message: message.trim() || 'Vi phạm.',
                  facesCount:
                    typeof (data as { facesCount?: unknown }).facesCount === 'number'
                      ? (data as { facesCount: number }).facesCount
                      : undefined,
                  ...(enrolledSid ? { enrolledStudentId: enrolledSid } : {}),
                  faces: Array.isArray((data as { faces?: unknown }).faces)
                    ? ((data as { faces: any[] }).faces.map((f) => ({
                        id:
                          typeof f?.id === 'number'
                            ? f.id
                            : typeof f?.id === 'string' && f.id
                              ? f.id
                              : undefined,
                        theta: typeof f?.theta === 'number' ? (f.theta as number) : undefined,
                        phi: typeof f?.phi === 'number' ? (f.phi as number) : undefined,
                        direction: typeof f?.direction === 'string' ? (f.direction as string) : undefined,
                        lookingAway:
                          typeof f?.looking_away === 'boolean' ? (f.looking_away as boolean) : undefined,
                      })) as Array<{ direction?: string; lookingAway?: boolean }>)
                    : undefined,
                  snapshotDataUrl: snapWithOverlay,
                });
                if (violationTimeoutRef.current) clearTimeout(violationTimeoutRef.current);
                violationTimeoutRef.current = setTimeout(() => {
                  setViolation(null);
                  violationTimeoutRef.current = null;
                }, SNAPSHOT_TTL_MS);
              }
            }
          } finally {
            pendingCheckRef.current = false;
            setStatus('idle');
          }
        };

        intervalRef.current = setInterval(check, CAPTURE_INTERVAL_MS);
        await check();
      } catch {
        if (!cancelled) {
          setError('Không thể mở camera. Vui lòng cấp quyền camera để giám sát.');
          setActive(false);
        }
      }
    })();

    return () => {
      cancelled = true;
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      setStream(null);
      setActive(false);
      setStatus('idle');
      setFaceOverlay(null);
      lastViolationPopupCountRef.current = 0;
      if (violationTimeoutRef.current) {
        clearTimeout(violationTimeoutRef.current);
        violationTimeoutRef.current = null;
      }
    };
  }, [enabled, clearViolation]);

  return { videoRef, stream, active, status, error, gazeResult, faceOverlay, violation, clearViolation };
}
