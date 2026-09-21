import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useQuizStore } from '@/store/quizStore';

const reset = (streak: number, lastActiveDate: string | null, totalXp: number) => {
  useQuizStore.setState({ streak, lastActiveDate, totalXp });
};

describe('recordActivity: streak + XP', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('first activity → streak 1, +10 XP', () => {
    vi.setSystemTime(new Date('2026-03-10T12:00:00.000Z'));
    reset(0, null, 0);

    useQuizStore.getState().recordActivity();

    const s = useQuizStore.getState();
    expect(s.streak).toBe(1);
    expect(s.lastActiveDate).toBe('2026-03-10');
    expect(s.totalXp).toBe(10);
  });

  it('same-day activity → no change', () => {
    vi.setSystemTime(new Date('2026-03-10T23:30:00.000Z'));
    reset(1, '2026-03-10', 10);

    useQuizStore.getState().recordActivity();

    const s = useQuizStore.getState();
    expect(s.streak).toBe(1);
    expect(s.lastActiveDate).toBe('2026-03-10');
    expect(s.totalXp).toBe(10);
  });

  it('next-day activity → streak 2, +10 XP', () => {
    vi.setSystemTime(new Date('2026-03-11T08:00:00.000Z'));
    reset(1, '2026-03-10', 10);

    useQuizStore.getState().recordActivity();

    const s = useQuizStore.getState();
    expect(s.streak).toBe(2);
    expect(s.lastActiveDate).toBe('2026-03-11');
    expect(s.totalXp).toBe(20);
  });

  it('3-day gap → streak resets to 1, +10 XP', () => {
    vi.setSystemTime(new Date('2026-03-10T08:00:00.000Z'));
    reset(3, '2026-03-07', 20);

    useQuizStore.getState().recordActivity();

    const s = useQuizStore.getState();
    expect(s.streak).toBe(1);
    expect(s.lastActiveDate).toBe('2026-03-10');
    expect(s.totalXp).toBe(30);
  });

  it('answering a question records activity (wired inside answerQuestion)', () => {
    vi.setSystemTime(new Date('2026-03-10T12:00:00.000Z'));
    reset(0, null, 0);

    useQuizStore.getState().loadQuestions();
    useQuizStore.setState({ currentIndex: 0 });
    const first = useQuizStore.getState().questions[0];
    useQuizStore.getState().answerQuestion(first.id, 0);

    const s = useQuizStore.getState();
    expect(s.answers).toHaveLength(1);
    expect(s.totalXp).toBe(10);
    expect(s.streak).toBe(1);
  });
});