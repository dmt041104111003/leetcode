'use client';

import { useEffect, useCallback } from 'react';
import type { ViolationInfo, GazeResult, ProctoringStatus, ProctoringFaceOverlay } from '../hooks/useProctoring';

type ProctoringCameraProps = {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  stream: MediaStream | null;
  active: boolean;
  status?: ProctoringStatus;
  error: string | null;
  gazeResult?: GazeResult | null;
  faceOverlay?: ProctoringFaceOverlay | null;
  enabled?: boolean;
};

export function ProctoringCamera({
  videoRef,
  stream,
  active,
  status = 'idle',
  error,
  gazeResult = null,
  faceOverlay = null,
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

  // Note: We intentionally do NOT render bbox/arrow on the live camera view.

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
        </div>
      )}
    </div>
  );
}

type ViolationPopupProps = {
  violation: ViolationInfo;
  onClose: () => void;
};

export function ViolationPopup({ violation, onClose }: ViolationPopupProps) {
  if (!violation) return null;
  const snap = violation.snapshotDataUrl;
  const hasSnap = typeof snap === 'string' && snap.startsWith('data:image/');
  const msgText = violation.message ? String(violation.message) : '';
  const enrolledId =
    typeof violation.enrolledStudentId === 'string' && violation.enrolledStudentId.trim()
      ? violation.enrolledStudentId.trim()
      : '';
  const faces = Array.isArray(violation.faces) ? violation.faces : [];
  const f = faces[0];
  // Chỉ MSSV định danh (chuỗi) mới được hiển thị; id numeric (track id) không hiển thị như MSSV.
  const mssvLabel = typeof f?.id === 'string' && f.id.trim() ? f.id.trim() : enrolledId;
  if (!hasSnap && !msgText && !mssvLabel) return null;
  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Thông báo vi phạm giám sát"
    >
      <div className="absolute inset-0 bg-black/50" onClick={onClose} aria-hidden="true" />
      <div
        className="relative w-[85vmin] max-w-[92vw] max-h-[92vh] overflow-y-auto rounded-xl bg-transparent shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        {hasSnap ? (
          <div className="relative w-full aspect-[4/3]">
            <img
              src={snap}
              alt="Violation snapshot"
              className="w-full h-full object-cover rounded-lg border border-white/60 bg-black"
            />
          </div>
        ) : (
          <p className="rounded-lg bg-black/55 px-3 py-2 text-center text-sm text-white/80">
            Không có ảnh kèm trong phản hồi.
          </p>
        )}

        {(f || enrolledId || msgText) && (
          <div className="mt-2 rounded-lg bg-black/60 px-3 py-2 text-white">
            {f ? (
              <div className="text-sm leading-snug">
                <p className="font-medium">
                  {mssvLabel ? `MSSV ${mssvLabel}` : 'Thí sinh'}
                  {f.lookingAway === true ? ' — lệch' : ''}
                </p>
                <p className="opacity-95">
                  {f.direction ?? '—'}
                  {(typeof f.theta === 'number' || typeof f.phi === 'number') && (
                    <>
                      {' '}
                      <span className="text-xs opacity-80">
                        (θ={typeof f.theta === 'number' ? f.theta.toFixed(3) : '—'} rad, φ=
                        {typeof f.phi === 'number' ? f.phi.toFixed(3) : '—'} rad)
                      </span>
                    </>
                  )}
                </p>
              </div>
            ) : (
              <div className="text-sm leading-snug space-y-1">
                {enrolledId ? (
                  <p className="font-medium">MSSV {enrolledId}</p>
                ) : null}
                {msgText ? (
                  <p className="opacity-95 whitespace-pre-line">{msgText}</p>
                ) : null}
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={onClose}
          className="mt-3 w-full rounded-lg bg-white/90 px-4 py-2.5 font-medium text-gray-900 hover:bg-white focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-black/30"
        >
          Đã hiểu
        </button>
      </div>
    </div>
  );
}
