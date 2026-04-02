'use client';

import type { ReactNode } from 'react';

type EnrollDirectionGuideProps = {
  activePhase: number;
  betweenSteps?: boolean;
  /** `overlay`: vẽ trực tiếp trên camera; `card`: khối riêng (ít dùng). */
  variant?: 'overlay' | 'card';
  /** @deprecated Dùng `variant="overlay"` */
  compact?: boolean;
};

const ENROLL_GUIDE_STEPS = 3;

const STEP_LABELS: Record<number, string> = {
  0: 'Nhấn «Bắt đầu định danh».',
  1: 'Nhìn thẳng vào camera.',
  2: 'Hướng nhìn sang trái (cơ thể bạn).',
  3: 'Hướng nhìn sang phải.',
};

function ArrowLeft({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <path d="M88 60H28" fill="none" stroke="currentColor" strokeWidth={10} strokeLinecap="round" />
      <path
        d="M42 34 L16 60 L42 86"
        fill="none"
        stroke="currentColor"
        strokeWidth={10}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ArrowRight({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <path d="M32 60H92" fill="none" stroke="currentColor" strokeWidth={10} strokeLinecap="round" />
      <path
        d="M78 34 L104 60 L78 86"
        fill="none"
        stroke="currentColor"
        strokeWidth={10}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CenterAim({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <circle cx={60} cy={60} r={36} fill="none" stroke="currentColor" strokeWidth={4} opacity={0.35} />
      <circle cx={60} cy={60} r={10} fill="currentColor" opacity={0.9} />
      <path
        d="M60 12v14M60 94v14M12 60h14M94 60h14"
        fill="none"
        stroke="currentColor"
        strokeWidth={5}
        strokeLinecap="round"
        opacity={0.65}
      />
    </svg>
  );
}

function IdleRing({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 120" className={className} aria-hidden>
      <circle cx={60} cy={60} r={44} fill="none" stroke="currentColor" strokeWidth={3} opacity={0.25} />
      <path
        d="M60 24 A 36 36 0 1 1 59.99 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={5}
        strokeLinecap="round"
        opacity={0.7}
      />
    </svg>
  );
}

function renderGraphic(
  phase: number,
  betweenSteps: boolean,
  mode: 'overlay' | 'card',
  compact: boolean
): ReactNode {
  const iconOverlay =
    'h-[5.5rem] w-[5.5rem] sm:h-28 sm:w-28 drop-shadow-[0_2px_8px_rgba(0,0,0,0.85)] motion-safe:animate-pulse';
  const iconCard = compact
    ? 'h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20'
    : 'h-28 w-28 sm:h-32 sm:w-32';
  const arrowClass =
    (mode === 'overlay' ? iconOverlay : iconCard) + ' text-amber-300 sm:text-amber-200';

  if (betweenSteps) {
    const tick =
      mode === 'overlay'
        ? 'flex h-24 w-24 items-center justify-center rounded-full bg-emerald-500/90 text-4xl font-bold text-white shadow-lg ring-2 ring-white/40 motion-safe:animate-pulse sm:h-28 sm:w-28'
        : `flex ${compact ? 'h-16 w-16 text-2xl' : 'h-28 w-28 text-4xl'} items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700 motion-safe:animate-pulse dark:bg-emerald-900/40 dark:text-emerald-300`;
    return <div className={tick}>✓</div>;
  }
  if (phase === 0) {
    return <IdleRing className={iconOverlay + ' text-sky-200 opacity-95'} />;
  }
  if (phase === 1) return <CenterAim className={arrowClass} />;
  if (phase === 2) return <ArrowLeft className={arrowClass} />;
  return <ArrowRight className={arrowClass} />;
}

export function EnrollDirectionGuide({
  activePhase,
  betweenSteps = false,
  variant = 'card',
  compact = false,
}: EnrollDirectionGuideProps) {
  const phase = Math.max(0, Math.min(ENROLL_GUIDE_STEPS, Math.floor(activePhase)));
  const label = STEP_LABELS[phase] ?? STEP_LABELS[0];

  if (variant === 'overlay') {
    const graphic = renderGraphic(phase, betweenSteps, 'overlay', false);
    const stepBadge =
      phase === 0 ? 'Chuẩn bị' : betweenSteps ? 'Chuyển bước…' : `Bước ${phase}/${ENROLL_GUIDE_STEPS}`;
    return (
      <div
        className="pointer-events-none absolute inset-0 z-10 flex flex-col justify-between bg-gradient-to-b from-black/35 via-transparent to-black/45 p-2 sm:p-3"
        aria-live="polite"
      >
        <div className="flex justify-center">
          <span className="rounded-full border border-white/25 bg-black/55 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-white backdrop-blur-[2px] sm:text-xs">
            {stepBadge}
          </span>
        </div>
        <div className="flex flex-1 items-center justify-center py-2">{graphic}</div>
      </div>
    );
  }

  const iconBox = compact ? 'h-[4.5rem] w-[4.5rem] sm:h-20 sm:w-20' : 'h-28 w-28 sm:h-32 sm:w-32';
  const arrowClassCard = `${iconBox} text-amber-600 dark:text-amber-400 motion-safe:animate-pulse`;
  let graphicCard: ReactNode;
  if (betweenSteps) {
    graphicCard = (
      <div
        className={`flex ${compact ? 'h-16 w-16 text-2xl' : 'h-28 w-28 text-4xl'} items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700 motion-safe:animate-pulse dark:bg-emerald-900/40 dark:text-emerald-300`}
      >
        ✓
      </div>
    );
  } else if (phase === 0) {
    graphicCard = <IdleRing className={`${arrowClassCard} text-sky-600 dark:text-sky-400 opacity-80`} />;
  } else if (phase === 1) {
    graphicCard = <CenterAim className={arrowClassCard} />;
  } else if (phase === 2) {
    graphicCard = <ArrowLeft className={arrowClassCard} />;
  } else {
    graphicCard = <ArrowRight className={arrowClassCard} />;
  }

  const wrap = compact
    ? 'mt-0 rounded-xl border border-sky-200/80 bg-gradient-to-br from-sky-50 to-white px-2.5 py-2 dark:border-slate-600 dark:from-slate-800 dark:to-slate-900'
    : 'mt-3 rounded-2xl border border-sky-200/80 bg-gradient-to-b from-sky-50 via-white to-blue-50/90 px-4 py-4 shadow-inner dark:border-slate-600 dark:from-slate-800/90 dark:via-slate-900 dark:to-slate-800/90';
  const inner = compact ? 'flex items-center gap-3' : 'flex flex-col items-center gap-2 sm:flex-row sm:justify-center sm:gap-6';

  return (
    <div className={wrap} aria-live="polite">
      <div className={inner}>
        <div
          className={`flex shrink-0 items-center justify-center rounded-lg bg-white/90 shadow-sm ring-1 ring-sky-100 dark:bg-slate-800/90 dark:ring-slate-600 ${compact ? 'p-1' : 'min-h-[8rem] w-full max-w-[10rem]'}`}
        >
          {graphicCard}
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-700/90 dark:text-sky-300/90">eKYC</p>
          <p className={`mt-0.5 font-medium leading-snug text-slate-800 dark:text-slate-100 ${compact ? 'text-xs sm:text-sm' : 'text-sm'}`}>
            {label}
          </p>
          {!compact ? (
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Trái/phải theo <span className="font-medium text-slate-600 dark:text-slate-300">cơ thể bạn</span>, ảnh đã mirror
              như màn hình.
            </p>
          ) : (
            <p className="mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400 sm:text-xs">
              Giữ hướng nhìn khớp mũi tên vài giây liên tục + đủ khung; trái/phải theo cơ thể bạn.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
