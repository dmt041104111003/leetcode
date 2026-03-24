'use client';

import { useState, useEffect } from 'react';

export function useCountdown(endAt: string): number {
  const [remainingMs, setRemainingMs] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return Math.max(0, new Date(endAt).getTime() - Date.now());
  });

  useEffect(() => {
    const end = new Date(endAt).getTime();
    const tick = () => setRemainingMs((r) => Math.max(0, end - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [endAt]);

  return remainingMs;
}
