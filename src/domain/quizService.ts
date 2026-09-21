import { AnswerRecord } from '@/data/models/AnswerRecord';

/**
 * Pure domain logic — zero Zustand/React imports.
 */

export interface ProgressMetrics {
  answered: number;
  correct: number;
  accuracy: number;    // correct / answered * 100 (0 если answered = 0)
  completion: number;  // answered / total * 100
}

export function calculateProgress(
  answers: AnswerRecord[],
  total: number
): ProgressMetrics {
  const answered = answers.length;
  const correct = answers.filter((a) => a.isCorrect).length;
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
  const completion = total > 0 ? Math.round((answered / total) * 100) : 0;
  return { answered, correct, accuracy, completion };
}
