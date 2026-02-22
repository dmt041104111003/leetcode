'use client';

import { DIFFICULTY_LABELS, DIFFICULTY_CLASSES } from '../constants';

type DifficultyBadgeProps = { difficulty: string };

export default function DifficultyBadge({ difficulty }: DifficultyBadgeProps) {
  const d = difficulty?.toUpperCase() || '';
  const color = DIFFICULTY_CLASSES[d] ?? '';
  const label = DIFFICULTY_LABELS[d] ?? difficulty;
  return <span className={`text-sm font-medium ${color}`}>{label}</span>;
}
