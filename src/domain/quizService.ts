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

export interface ShuffledOption {
  text: string;
  correct: boolean;
  originalIndex: number;
}

/**
 * FNV-1a hash of the question id. Used as the PRNG seed so a given question
 * always renders its options in the same order (stable across re-renders,
 * reloads and sessions - no visual flicker, no test flakiness).
 */
export function seedFromId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/**
 * Fisher-Yates using a mulberry32 PRNG. Pure: never mutates the input.
 * `originalIndex` lets callers map a visual position back to the stored
 * answer index, because AnswerRecord.selectedIndex refers to the ORIGINAL
 * options array, not the displayed order.
 */
export function shuffleOptions(
  options: ReadonlyArray<{ text: string; correct: boolean }>,
  seed: number
): ShuffledOption[] {
  const indexed = options.map((o, i) => ({ ...o, originalIndex: i }));

  let s = seed >>> 0;
  const rand = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };

  const result = [...indexed];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
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
