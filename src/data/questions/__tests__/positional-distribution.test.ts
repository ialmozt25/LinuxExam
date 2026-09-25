import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Positional distribution invariant.
 *
 * The authored bank stored `correct: true` on index 0 for all 122 questions
 * (legacy generation prompts demanded key=[1]), so every consumer reading the
 * JSON directly - MAS voters, pending drafts, audits - saw the answer before
 * reading the stem. `tools/shuffle-bank.mjs` normalizes the stored order
 * deterministically (seed = cyrb53(id), Fisher-Yates/mulberry32); this test
 * keeps that regression closed. The render-time UI shuffle still runs, but it
 * no longer compensates for a data defect.
 *
 * ESM-safe on purpose: `import.meta.url`, never `__dirname`.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const BANK_DIR = join(HERE, '..');
const EXPECTED_TOPICS = 12;
const EXPECTED_QUESTIONS = 122;
const MAX_POSITION_SHARE = 0.6;

interface RawQuestion {
  id: string;
  options: { text: string; correct: boolean }[];
}

/** Topic files = every *.json that is not a manifest (`_order`, `_topics`). */
const topicFiles = readdirSync(BANK_DIR)
  .filter((f) => f.endsWith('.json') && !f.startsWith('_'))
  .sort();

const bank = topicFiles.map((file) => ({
  topic: file.replace(/\.json$/, ''),
  questions: JSON.parse(readFileSync(join(BANK_DIR, file), 'utf8')) as RawQuestion[],
}));

function positionCounts(): { counts: number[]; total: number } {
  const counts = [0, 0, 0, 0];
  let total = 0;
  for (const entry of bank) {
    for (const q of entry.questions) {
      const idx = q.options.findIndex((o) => o.correct);
      expect(idx, `${q.id}: stored correct option index`).toBeGreaterThanOrEqual(0);
      expect(idx, `${q.id}: stored correct option index`).toBeLessThan(4);
      counts[idx]++;
      total++;
    }
  }
  return { counts, total };
}

describe('bank positional distribution (tools/shuffle-bank.mjs)', () => {
  it('covers every topic file and the whole bank', () => {
    expect(topicFiles.length).toBe(EXPECTED_TOPICS);
    const total = bank.reduce((acc, entry) => acc + entry.questions.length, 0);
    expect(total).toBe(EXPECTED_QUESTIONS);
  });

  it('stores exactly one correct option per question', () => {
    for (const entry of bank) {
      for (const q of entry.questions) {
        expect(q.options.filter((o) => o.correct).length, q.id).toBe(1);
      }
    }
  });

  it('never concentrates more than 60% of keys on one position', () => {
    const { counts, total } = positionCounts();
    expect(total).toBeGreaterThan(0);
    counts.forEach((count, pos) => {
      expect(count / total, `pos${pos} share of ${total}`).toBeLessThanOrEqual(MAX_POSITION_SHARE);
    });
  });

  it('spreads keys across every position', () => {
    const { counts } = positionCounts();
    expect(counts.filter((c) => c > 0).length).toBe(4);
  });
});
