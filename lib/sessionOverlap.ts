export function timeRangesOverlap(
  startA: Date,
  endA: Date,
  startB: Date,
  endB: Date
): boolean {
  const a = startA.getTime();
  const b = endA.getTime();
  const c = startB.getTime();
  const d = endB.getTime();
  return a < d && c < b;
}

export type SessionWithTime = { id: number; classId: number | null; startAt: Date; endAt: Date };

export function hasOverlappingSession(
  sessions: SessionWithTime[],
  classId: number,
  startAt: Date,
  endAt: Date,
  excludeSessionId?: number
): boolean {
  return sessions.some(
    (s) =>
      s.classId === classId &&
      s.id !== excludeSessionId &&
      timeRangesOverlap(startAt, endAt, s.startAt, s.endAt)
  );
}

export type SessionWithClasses = { id: number; startAt: Date; endAt: Date; classIds: number[] };

export function hasOverlappingSessionForClasses(
  sessions: SessionWithClasses[],
  classIds: number[],
  startAt: Date,
  endAt: Date,
  excludeSessionId?: number
): boolean {
  if (classIds.length === 0) return false;
  const set = new Set(classIds);
  return sessions.some(
    (s) =>
      s.id !== excludeSessionId &&
      timeRangesOverlap(startAt, endAt, s.startAt, s.endAt) &&
      s.classIds.some((c) => set.has(c))
  );
}
