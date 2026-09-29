import { describe, it, expect, beforeEach, vi } from 'vitest';

const STORAGE_KEY = 'rhcsa_progress';

const V1_PAYLOAD = {
  state: {
    answers: [{ questionId: 'fp_001', selectedIndex: 0, isCorrect: true }],
    currentIndex: 2,
    isPro: true,
  },
  version: 1,
};

// v2 payload: written before `optionText` existed, and — unlike v1 — at a version
// that only the v2 → v3 step can see. `answers` deliberately carries no optionText.
const V2_PAYLOAD = {
  state: {
    answers: [{ questionId: 'fp_001', selectedIndex: 0, isCorrect: true }],
    currentIndex: 2,
    isPro: true,
    streak: 0,
    lastActiveDate: null,
    totalXp: 0,
  },
  version: 2,
};

function readPersisted(): { state: Record<string, unknown>; version: number } {
  return JSON.parse(String(localStorage.getItem(STORAGE_KEY))) as {
    state: Record<string, unknown>;
    version: number;
  };
}

describe('persist migration v1 → v2', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('adds gamification defaults while preserving the v1 state', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V1_PAYLOAD));

    const { useQuizStore } = await import('@/store/quizStore');
    const s = useQuizStore.getState();

    expect(s.streak).toBe(0);
    expect(s.lastActiveDate).toBeNull();
    expect(s.totalXp).toBe(0);

    expect(s.currentIndex).toBe(2);
    expect(s.isPro).toBe(true);
    expect(s.answers).toHaveLength(1);
    expect(s.answers[0].questionId).toBe('fp_001');

    // v1 is two steps behind now: the write-back stamps the current version.
    useQuizStore.setState({ streak: 1 });
    expect(readPersisted().version).toBe(3);
  });

  it('v1 → v3: геймификация и version bump одновременно', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V1_PAYLOAD));
    const { useQuizStore } = await import('@/store/quizStore');
    const s = useQuizStore.getState();
    expect(s.streak).toBe(0);
    expect(s.lastActiveDate).toBeNull();
    expect(s.totalXp).toBe(0);
    useQuizStore.setState({ lastActiveDate: '2026-03-10' });
    const raw = readPersisted();
    expect(raw.version).toBe(3);
    expect(raw.state.lastActiveDate).toBe('2026-03-10');
  });

  it('migrated store persists the new fields under version 3', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V1_PAYLOAD));

    const { useQuizStore } = await import('@/store/quizStore');
    useQuizStore.setState({ streak: 4, totalXp: 40, lastActiveDate: '2026-03-10' });

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(String(raw)) as { state: Record<string, unknown>; version: number };

    expect(parsed.version).toBe(3);
    expect(parsed.state.streak).toBe(4);
    expect(parsed.state.totalXp).toBe(40);
    expect(parsed.state.lastActiveDate).toBe('2026-03-10');
  });

  it('v2 → v3 leaves answers untouched in migrate (bank is empty there)', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V2_PAYLOAD));

    const { useQuizStore } = await import('@/store/quizStore');
    const s = useQuizStore.getState();

    // migrate cannot reach the bank, so nothing is rewritten here: the record is
    // still the v2 shape. `optionText` arrives later, from loadQuestions →
    // normalizeAnswersAgainstBank (covered in persist-answer-reorder.test.ts).
    expect(s.questions).toHaveLength(0);
    expect(s.answers).toHaveLength(1);
    expect(s.answers[0]).toEqual({ questionId: 'fp_001', selectedIndex: 0, isCorrect: true });
    expect(readPersisted().version).toBe(3);
  });

  it('a fresh store starts with gamification defaults', async () => {
    const { useQuizStore } = await import('@/store/quizStore');
    const s = useQuizStore.getState();

    expect(s.streak).toBe(0);
    expect(s.lastActiveDate).toBeNull();
    expect(s.totalXp).toBe(0);
  });
});
