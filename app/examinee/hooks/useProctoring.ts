'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export type ViolationInfo = {
  type: string;
  message: string;
} | null;

export type GazeResult = string | null;

const CAPTURE_INTERVAL_MS = 1500;
const JPEG_QUALITY = 0.85;
const MAX_WIDTH = 640;

export function useProctoring(enabled: boolean) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [violation, setViolation] = useState<ViolationInfo>(null);
  const [gazeResult, setGazeResult] = useState<GazeResult>(null);
  const [error, setError] = useState<string | null>(null);
  const [active, setActive] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pendingCheckRef = useRef(false);

  const clearViolation = useCallback(() => setViolation(null), []);

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
      setError(null);
      setGazeResult(null);
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

        const check = async () => {
          if (pendingCheckRef.current) return;
          const v = videoRef.current;
          const s = streamRef.current;
          if (!v || !s || v.readyState !== 4 || v.videoWidth === 0) return;
          pendingCheckRef.current = true;
          const w = Math.min(v.videoWidth, MAX_WIDTH);
          const h = Math.round((v.videoHeight * w) / v.videoWidth);
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            pendingCheckRef.current = false;
            return;
          }
          ctx.drawImage(v, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
          const base64 = dataUrl.replace(/^data:image\/jpeg;base64,/, '');

          try {
            const res = await fetch('/api/examinee/proctoring/check', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ imageBase64: base64 }),
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
              const msg =
                typeof (data as { error?: string }).error === 'string'
                  ? (data as { error: string }).error
                  : `Lỗi giám sát (${res.status})`;
              setError(msg);
              setGazeResult(null);
              pendingCheckRef.current = false;
              return;
            }

            const gazeDirection = typeof (data as { gazeDirection?: string }).gazeDirection === 'string'
              ? (data as { gazeDirection: string }).gazeDirection
              : '';
            const message = typeof data.message === 'string' ? data.message : gazeDirection;
            setGazeResult(gazeDirection || message || null);
            setError(null);

            if (data.violation) {
              setViolation({
                type: (data as { type?: string }).type ?? 'violation',
                message: message || gazeDirection || 'Vi phạm.',
              });
            }
          } finally {
            pendingCheckRef.current = false;
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
    };
  }, [enabled]);

  return { videoRef, stream, violation, clearViolation, error, active, gazeResult };
}
