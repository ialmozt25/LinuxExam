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
  });

  it('migrated store persists the new fields under version 2', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V1_PAYLOAD));

    const { useQuizStore } = await import('@/store/quizStore');
    useQuizStore.setState({ streak: 4, totalXp: 40, lastActiveDate: '2026-03-10' });

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(String(raw)) as { state: Record<string, unknown>; version: number };

    expect(parsed.version).toBe(2);
    expect(parsed.state.streak).toBe(4);
    expect(parsed.state.totalXp).toBe(40);
    expect(parsed.state.lastActiveDate).toBe('2026-03-10');
  });

  it('a fresh store starts with gamification defaults', async () => {
    const { useQuizStore } = await import('@/store/quizStore');
    const s = useQuizStore.getState();

    expect(s.streak).toBe(0);
    expect(s.lastActiveDate).toBeNull();
    expect(s.totalXp).toBe(0);
  });
});