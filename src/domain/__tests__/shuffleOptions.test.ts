import { describe, it, expect, beforeAll } from 'vitest';
import { shuffleOptions, seedFromId } from '../quizService';
import { loadAll } from '@/data/questions';

const sampleOptions = [
  { text: 'A', correct: true },
  { text: 'B', correct: false },
  { text: 'C', correct: false },
  { text: 'D', correct: false },
];

describe('shuffleOptions', () => {
  it('returns same length', () => {
    expect(shuffleOptions(sampleOptions, 42)).toHaveLength(4);
  });

  it('preserves all texts', () => {
    const out = shuffleOptions(sampleOptions, 42);
    expect(out.map((o) => o.text).sort()).toEqual(['A', 'B', 'C', 'D']);
  });

  it('preserves correct flag on same text', () => {
    const out = shuffleOptions(sampleOptions, 42);
    expect(out.find((o) => o.text === 'A')?.correct).toBe(true);
  });

  it('is deterministic for same seed', () => {
    const a = shuffleOptions(sampleOptions, 42).map((o) => o.text).join('');
    const b = shuffleOptions(sampleOptions, 42).map((o) => o.text).join('');
    expect(a).toBe(b);
  });

  it('different seeds can produce different order', () => {
    const base = shuffleOptions(sampleOptions, 1).map((o) => o.text).join('');
    let found = false;
    for (let seed = 2; seed < 100; seed++) {
      if (shuffleOptions(sampleOptions, seed).map((o) => o.text).join('') !== base) {
        found = true;
        break;
      }
    }
    expect(found).toBe(true);
  });

  it('does not mutate input', () => {
    const before = JSON.stringify(sampleOptions);
    shuffleOptions(sampleOptions, 42);
    expect(JSON.stringify(sampleOptions)).toBe(before);
  });

  it('originalIndex maps back to input', () => {
    const out = shuffleOptions(sampleOptions, 42);
    out.forEach((o) => {
      expect(o.text).toBe(sampleOptions[o.originalIndex].text);
    });
  });
});

describe('seedFromId', () => {
  it('is deterministic', () => {
    expect(seedFromId('q1')).toBe(seedFromId('q1'));
  });
  it('different ids produce different seeds', () => {
    expect(seedFromId('q1')).not.toBe(seedFromId('q2'));
  });
  it('positive integer', () => {
    expect(seedFromId('q1')).toBeGreaterThan(0);
    expect(Number.isInteger(seedFromId('q1'))).toBe(true);
  });
});

interface RawQuestion {
  id: string;
  options: { text: string; correct: boolean }[];
}

let questions: RawQuestion[] = [];

// The bank is reached through per-topic chunks now, so it is awaited once here
// instead of being statically imported at module load.
beforeAll(async () => {
  questions = (await loadAll()) as unknown as RawQuestion[];
});

/**
 * Guards the reason option shuffle was introduced: 3 of 5 testers noticed that
 * every correct answer sat at position 1. The stored bank itself was fixed on
 * 2026-09-26 (tools/shuffle-bank.mjs), so the render-time shuffle no longer
 * compensates for a data defect - these assertions still run against the real
 * bank, not a synthetic fixture.
 */
describe('option shuffle vs the real question bank', () => {
  it('stores keys across more than one position (positional-bias fix)', () => {
    const stored = { 0: 0, 1: 0, 2: 0, 3: 0 } as Record<number, number>;
    questions.forEach((q) => {
      const idx = q.options.findIndex((o) => o.correct);
      expect(idx).toBeGreaterThanOrEqual(0);
      stored[idx]++;
    });
    expect(Object.values(stored).filter((v) => v > 0).length).toBeGreaterThan(1);
  });

  it('spreads correct answers across more than one visual position', () => {
    const visual = { 0: 0, 1: 0, 2: 0, 3: 0 } as Record<number, number>;
    questions.forEach((q) => {
      const out = shuffleOptions(q.options, seedFromId(q.id));
      visual[out.findIndex((o) => o.correct)]++;
    });
    const distinct = Object.values(visual).filter((v) => v > 0).length;
    expect(distinct).toBeGreaterThan(1);
  });

  it('keeps correctness tied to the option text for every question', () => {
    questions.forEach((q) => {
      const correctText = q.options.find((o) => o.correct)?.text;
      const out = shuffleOptions(q.options, seedFromId(q.id));
      expect(out.find((o) => o.correct)?.text).toBe(correctText);
    });
  });

  it('originalIndex maps back to the stored array for every option', () => {
    questions.forEach((q) => {
      shuffleOptions(q.options, seedFromId(q.id)).forEach((o) => {
        expect(o.text).toBe(q.options[o.originalIndex].text);
      });
    });
  });

  it('gives a stable order for the same question every time', () => {
    questions.forEach((q) => {
      const a = shuffleOptions(q.options, seedFromId(q.id)).map((o) => o.text);
      const b = shuffleOptions(q.options, seedFromId(q.id)).map((o) => o.text);
      expect(a).toEqual(b);
    });
  });

  it('does not mutate the imported bank', () => {
    const snapshot = questions.map((q) => q.options.map((o) => o.text).join('|'));
    questions.forEach((q) => shuffleOptions(q.options, seedFromId(q.id)));
    expect(questions.map((q) => q.options.map((o) => o.text).join('|'))).toEqual(snapshot);
  });
});

