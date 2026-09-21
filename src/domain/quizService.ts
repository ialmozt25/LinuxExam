import { AnswerRecord } from '@/data/models/AnswerRecord';

/**
 * Pure domain logic — zero Zustand/React imports.
 */

export function calculateProgress(answers: AnswerRecord[], total: number): number {
  if (total === 0) return 0;
  const correctCount = answers.filter((a) => a.isCorrect).length;
  return Math.round((correctCount / total) * 100);
}
