import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';

const STORAGE_KEY = 'rhcsa_progress';

/**
 * v4-состояние: ровно те поля, которые персистит `partialize` на версии 4
 * (spec 052, FSRS-lite добавил `scheduledReviews`). Онбординг-полей ещё нет.
 */
const V4_PAYLOAD = {
  state: {
    answers: [{ questionId: 'fp_001', selectedIndex: 0, isCorrect: true, optionText: 'A' }],
    currentIndex: 3,
    isPro: true,
    streak: 5,
    lastActiveDate: '2026-10-01',
    totalXp: 50,
    wrongQuestionIds: ['fp_002'],
    questionStats: { fp_001: { attempts: 2, correct: 1, lastAt: '2026-10-01' } },
    scheduledReviews: { fp_001: { next: 1893456000000, stability: 1.5, difficulty: 0.25 } },
    reviewQuestionIds: ['fp_001'],
    reviewAnswers: [],
    isQuizInProgress: true,
    examActive: false,
    examStartedAt: null,
    examDurationMs: 0,
    examQuestionIds: [],
    examAnswers: [],
  },
  version: 4,
};

function readPersisted(): { state: Record<string, unknown>; version: number } {
  return JSON.parse(String(localStorage.getItem(STORAGE_KEY))) as {
    state: Record<string, unknown>;
    version: number;
  };
}

describe('persist migration v4 → v5 (онбординг, spec 060)', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('добавляет онбординг-поля с дефолтами и сохраняет 17 старых полей', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V4_PAYLOAD));

    const { useQuizStore } = await import('@/store/quizStore');
    const s = useQuizStore.getState();

    // Новые поля с дефолтами: прохождение не отмечено, цель не выбрана.
    expect(s.onboardingGoal).toBeNull();
    expect(s.hasCompletedOnboarding).toBe(false);

    // 17 старых полей на месте и не перезаписаны дефолтами.
    expect(s.answers).toHaveLength(1);
    expect(s.answers[0].questionId).toBe('fp_001');
    expect(s.answers[0].optionText).toBe('A');
    expect(s.currentIndex).toBe(3);
    expect(s.isPro).toBe(true);
    expect(s.streak).toBe(5);
    expect(s.lastActiveDate).toBe('2026-10-01');
    expect(s.totalXp).toBe(50);
    expect(s.wrongQuestionIds).toEqual(['fp_002']);
    expect(s.questionStats.fp_001.attempts).toBe(2);
    expect(s.scheduledReviews.fp_001.stability).toBe(1.5);
    expect(s.reviewQuestionIds).toEqual(['fp_001']);
    expect(s.reviewAnswers).toEqual([]);
    expect(s.isQuizInProgress).toBe(true);
    expect(s.examActive).toBe(false);
    expect(s.examStartedAt).toBeNull();
    expect(s.examDurationMs).toBe(0);
    expect(s.examQuestionIds).toEqual([]);
    expect(s.examAnswers).toEqual([]);
  });

  it('пишет состояние под текущей версией, включая оба онбординг-поля', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V4_PAYLOAD));
    const { useQuizStore } = await import('@/store/quizStore');

    useQuizStore.setState({ onboardingGoal: 'rhcsa', hasCompletedOnboarding: true });

    const raw = readPersisted();
    // Версия на запись — текущая (6 с spec 061, retention добавил два поля).
    expect(raw.version).toBe(6);
    expect(raw.state.onboardingGoal).toBe('rhcsa');
    expect(raw.state.hasCompletedOnboarding).toBe(true);
    expect(raw.state.streak).toBe(5);
  });

  it('свежий store стартует с онбординг-полями по умолчанию', async () => {
    const { useQuizStore } = await import('@/store/quizStore');
    const s = useQuizStore.getState();
    expect(s.onboardingGoal).toBeNull();
    expect(s.hasCompletedOnboarding).toBe(false);
  });

  it('миграция v4→v5 идемпотентна: повторный проход не дублирует и не сбрасывает выбор', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V4_PAYLOAD));
    const { useQuizStore } = await import('@/store/quizStore');

    useQuizStore.setState({ onboardingGoal: 'interview' });
    // Состояние уже v5: тот же payload версии 5 проходит migrate как no-op.
    const v5 = readPersisted();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v5));

    const again = await import('@/store/quizStore');
    expect(again.useQuizStore.getState().onboardingGoal).toBe('interview');
    expect(again.useQuizStore.getState().hasCompletedOnboarding).toBe(false);
  });
});

describe('useNeedsOnboarding (spec 060)', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  it('true при пустом состоянии И отсутствии персиста (новый пользователь)', async () => {
    const { useQuizStore } = await import('@/store/quizStore');
    const { useNeedsOnboarding } = await import('@/store/onboarding');

    act(() => {
      useQuizStore.setState({ hasCompletedOnboarding: false, questionStats: {} });
    });

    const { result } = renderHook(() => useNeedsOnboarding());
    expect(result.current).toBe(true);
  });

  it('false при hasCompletedOnboarding = true (даже если статистика пуста)', async () => {
    const { useQuizStore } = await import('@/store/quizStore');
    const { useNeedsOnboarding } = await import('@/store/onboarding');

    act(() => {
      useQuizStore.setState({ hasCompletedOnboarding: true, questionStats: {} });
    });

    const { result } = renderHook(() => useNeedsOnboarding());
    expect(result.current).toBe(false);
  });

  it('false при непустых questionStats (существующий пользователь после апдейта)', async () => {
    const { useQuizStore } = await import('@/store/quizStore');
    const { useNeedsOnboarding } = await import('@/store/onboarding');

    act(() => {
      useQuizStore.setState({
        hasCompletedOnboarding: false,
        questionStats: { fp_001: { attempts: 1, correct: 1, lastAt: '2026-10-03' } },
      });
    });

    const { result } = renderHook(() => useNeedsOnboarding());
    expect(result.current).toBe(false);
  });

  it('переключается на false после completeOnboarding()', async () => {
    const { useQuizStore } = await import('@/store/quizStore');
    const { useNeedsOnboarding } = await import('@/store/onboarding');

    act(() => {
      useQuizStore.setState({ hasCompletedOnboarding: false, questionStats: {} });
    });
    const { result } = renderHook(() => useNeedsOnboarding());
    expect(result.current).toBe(true);

    act(() => {
      useQuizStore.getState().completeOnboarding();
    });
    expect(result.current).toBe(false);
  });

  it('resetOnboarding() возвращает гейт в true и очищает цель', async () => {
    const { useQuizStore } = await import('@/store/quizStore');
    act(() => {
      useQuizStore.setState({ hasCompletedOnboarding: true, onboardingGoal: 'rhcsa' });
      useQuizStore.getState().resetOnboarding();
    });
    expect(useQuizStore.getState().hasCompletedOnboarding).toBe(false);
    expect(useQuizStore.getState().onboardingGoal).toBeNull();
  });

  it('setOnboardingGoal() пишет цель, не трогая факт прохождения', async () => {
    const { useQuizStore } = await import('@/store/quizStore');
    act(() => {
      useQuizStore.getState().setOnboardingGoal('interview');
    });
    expect(useQuizStore.getState().onboardingGoal).toBe('interview');
    expect(useQuizStore.getState().hasCompletedOnboarding).toBe(false);
  });
});
