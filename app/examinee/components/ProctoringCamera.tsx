'use client';

import { useEffect, useCallback } from 'react';
import type { ViolationInfo, GazeResult } from '../hooks/useProctoring';

type ProctoringCameraProps = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  active: boolean;
  error: string | null;
  gazeResult?: GazeResult | null;
  enabled?: boolean;
};

export function ProctoringCamera({
  videoRef,
  stream,
  active,
  error,
  gazeResult = null,
  enabled = true,
}: ProctoringCameraProps) {
  const setVideoRef = useCallback(
    (el: HTMLVideoElement | null) => {
      (videoRef as React.MutableRefObject<HTMLVideoElement | null>).current = el;
      if (el && stream) {
        el.srcObject = stream;
        el.play().catch(() => {});
      }
    },
    [stream, videoRef]
  );

  useEffect(() => {
    if (!videoRef.current || !stream) return;
    videoRef.current.srcObject = stream;
    videoRef.current.play().catch(() => {});
  }, [stream, videoRef]);

  const showBox = enabled;
  const showVideo = active && stream;

  return (
    <div className="fixed bottom-4 right-4 z-20 flex flex-col items-end gap-2">
      {error && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 shadow">
          {error}
        </div>
      )}
      {showBox && (
        <div className="flex flex-col items-end gap-1 shrink-0">
          <div
            className="overflow-hidden rounded-xl border-2 border-gray-400 shadow-xl bg-black flex items-center justify-center"
            style={{ width: 192, height: 144 }}
            aria-label="Khung camera"
          >
            {showVideo ? (
              <video
                ref={setVideoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover block"
                style={{ transform: 'scaleX(-1)', width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              <svg className="w-10 h-10 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          {gazeResult != null && gazeResult !== '' && (
            <div className="text-xs text-gray-600 bg-white/90 rounded px-2 py-1.5 shadow">
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">Hướng mắt</p>
              <p className="font-medium text-gray-800">{gazeResult}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

type ViolationPopupProps = {
  violation: ViolationInfo;
  onClose: () => void;
};

const VIOLATION_LABELS: Record<string, string> = {
  violation: 'Vi phạm',
  looking_away: 'Mắt nhìn lệch',
  no_frame: 'Không có ảnh từ camera',
  no_face: 'Không nhận diện khuôn mặt',
  error: 'Lỗi giám sát',
};

export function ViolationPopup({ violation, onClose }: ViolationPopupProps) {
  if (!violation) return null;
  const label = VIOLATION_LABELS[violation.type] || violation.type || 'Vi phạm';
  const message = violation.message || '';
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="violation-title"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-md rounded-xl border-2 border-red-300 bg-white p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 id="violation-title" className="text-lg font-bold text-gray-900 mb-2">
          Cảnh báo vi phạm
        </h2>
        <div className="mb-6">
          <p className="text-sm font-semibold text-red-700 mb-1">{label}</p>
          {message ? <p className="text-gray-700">{message}</p> : null}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="w-full rounded-lg bg-red-600 px-4 py-2.5 font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
        >
          Đã hiểu
        </button>
      </div>
    </div>
  );
}
