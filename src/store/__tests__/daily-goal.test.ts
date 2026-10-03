import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useQuizStore } from '@/store/quizStore';
import { useDailyGoalProgress } from '@/store/dailyGoal';
import { renderHook, act } from '@testing-library/react';

const STORAGE_KEY = 'rhcsa_progress';

/**
 * v5-состояние: ровно те поля, которые персистил `partialize` на версии 5
 * (spec 060 добавил онбординг). Retention-полей (`dailyGoalXp`, `todayXp`) нет.
 */
const V5_PAYLOAD = {
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
    onboardingGoal: 'rhcsa',
    hasCompletedOnboarding: true,
  },
  version: 5,
};

function readPersisted(): { state: Record<string, unknown>; version: number } {
  return JSON.parse(String(localStorage.getItem(STORAGE_KEY))) as {
    state: Record<string, unknown>;
    version: number;
  };
}

describe('persist migration v5 → v6 (retention, spec 061)', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('добавляет retention-поля с дефолтами и сохраняет 19 старых полей', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V5_PAYLOAD));

    const { useQuizStore: store } = await import('@/store/quizStore');
    const s = store.getState();

    // Новые поля с дефолтами: цель 20 XP, дневной счётчик пуст.
    expect(s.dailyGoalXp).toBe(20);
    expect(s.todayXp).toBe(0);

    // 19 старых полей на месте и не перезаписаны дефолтами.
    expect(s.answers).toHaveLength(1);
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
    expect(s.onboardingGoal).toBe('rhcsa');
    expect(s.hasCompletedOnboarding).toBe(true);
  });

  it('пишет состояние под версией 7, включая оба retention-поля', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V5_PAYLOAD));
    const { useQuizStore: store } = await import('@/store/quizStore');

    store.setState({ todayXp: 15 });

    const raw = readPersisted();
    // Версия на запись — текущая (7 с spec 063: paywall добавил trialStartedAt).
    expect(raw.version).toBe(7);
    expect(raw.state.dailyGoalXp).toBe(20);
    expect(raw.state.todayXp).toBe(15);
    expect(raw.state.onboardingGoal).toBe('rhcsa');
  });

  it('свежий store: цель не подтверждена (null → picker), дневной счётчик 0', () => {
    const s = useQuizStore.getState();
    expect(s.dailyGoalXp).toBeNull();
    expect(s.todayXp).toBe(0);
  });

  it('миграция v5→v6 идемпотентна: повторный проход не дублирует и не сбрасывает выбор', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V5_PAYLOAD));
    const { useQuizStore: store } = await import('@/store/quizStore');

    store.getState().setDailyGoal(50);
    const v6 = readPersisted();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v6));

    const again = await import('@/store/quizStore');
    // Состояние уже v6: тот же payload проходит migrate как no-op.
    expect(again.useQuizStore.getState().dailyGoalXp).toBe(50);
    expect(again.useQuizStore.getState().todayXp).toBe(0);
  });
});

describe('setDailyGoal (spec 061)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('обновляет store и снимает null (picker больше не показывается)', () => {
    useQuizStore.setState({ dailyGoalXp: null });
    useQuizStore.getState().setDailyGoal(50);

    expect(useQuizStore.getState().dailyGoalXp).toBe(50);
  });

  it('принимает любой из трёх пресетов', () => {
    for (const xp of [10, 20, 50]) {
      useQuizStore.getState().setDailyGoal(xp);
      expect(useQuizStore.getState().dailyGoalXp).toBe(xp);
    }
  });
});

describe('recordActivity: totalXp + todayXp (spec 061)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('первая активность дня: totalXp +10 И todayXp +10', () => {
    vi.setSystemTime(new Date('2026-03-10T12:00:00.000Z'));
    useQuizStore.setState({
      streak: 0,
      lastActiveDate: null,
      totalXp: 0,
      todayXp: 0,
      dailyGoalXp: 20,
    });

    useQuizStore.getState().recordActivity();

    const s = useQuizStore.getState();
    expect(s.totalXp).toBe(10);
    expect(s.todayXp).toBe(10);
    expect(s.streak).toBe(1);
  });

  it('вторая активность в тот же день: no-op (ни totalXp, ни todayXp)', () => {
    vi.setSystemTime(new Date('2026-03-10T23:30:00.000Z'));
    useQuizStore.setState({
      streak: 1,
      lastActiveDate: '2026-03-10',
      totalXp: 10,
      todayXp: 10,
      dailyGoalXp: 20,
    });

    useQuizStore.getState().recordActivity();

    const s = useQuizStore.getState();
    expect(s.totalXp).toBe(10);
    expect(s.todayXp).toBe(10);
  });

  it('три ответа в разные дни → todayXp это счётчик одного дня', () => {
    vi.setSystemTime(new Date('2026-03-10T12:00:00.000Z'));
    useQuizStore.setState({
      streak: 0,
      lastActiveDate: null,
      totalXp: 0,
      todayXp: 0,
      dailyGoalXp: 20,
    });
    useQuizStore.getState().recordActivity();
    expect(useQuizStore.getState().todayXp).toBe(10);

    // Новый день: гидратация (или явный вызов) обнуляет дневной счётчик.
    vi.setSystemTime(new Date('2026-03-11T09:00:00.000Z'));
    useQuizStore.getState().resetTodayXpIfNewDay();
    expect(useQuizStore.getState().todayXp).toBe(0);

    useQuizStore.getState().recordActivity();
    const s = useQuizStore.getState();
    expect(s.todayXp).toBe(10);
    expect(s.totalXp).toBe(20);
    expect(s.streak).toBe(2);
  });
});

describe('resetTodayXpIfNewDay (spec 061)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('lastActiveDate != today → todayXp = 0', () => {
    vi.setSystemTime(new Date('2026-03-11T08:00:00.000Z'));
    useQuizStore.setState({ lastActiveDate: '2026-03-10', todayXp: 30 });

    useQuizStore.getState().resetTodayXpIfNewDay();

    expect(useQuizStore.getState().todayXp).toBe(0);
  });

  it('lastActiveDate == today → значение не трогается', () => {
    vi.setSystemTime(new Date('2026-03-10T08:00:00.000Z'));
    useQuizStore.setState({ lastActiveDate: '2026-03-10', todayXp: 30 });

    useQuizStore.getState().resetTodayXpIfNewDay();

    expect(useQuizStore.getState().todayXp).toBe(30);
  });

  it('lastActiveDate = null (свежий профиль) → todayXp = 0', () => {
    vi.setSystemTime(new Date('2026-03-10T08:00:00.000Z'));
    useQuizStore.setState({ lastActiveDate: null, todayXp: 30 });

    useQuizStore.getState().resetTodayXpIfNewDay();

    expect(useQuizStore.getState().todayXp).toBe(0);
  });

  it('гидратация в новый день обнуляет todayXp автоматически (onRehydrateStorage)', async () => {
    vi.resetModules();
    // Запись текущей версии со вчерашним днём и накопленным счётчиком: migrate
    // её не трогает, значит обнулить todayXp обязан onRehydrateStorage.
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const state = { ...V5_PAYLOAD.state, lastActiveDate: yesterday, dailyGoalXp: 20, todayXp: 30 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version: 6 }));

    const { useQuizStore: store } = await import('@/store/quizStore');

    expect(store.getState().todayXp).toBe(0);
    // Остальные поля вчерашней сессии поднялись нетронутыми.
    expect(store.getState().streak).toBe(5);
    expect(store.getState().dailyGoalXp).toBe(20);
  });

  it('гидратация в тот же день не трогает todayXp', async () => {
    vi.resetModules();
    const today = new Date().toISOString().slice(0, 10);
    const state = { ...V5_PAYLOAD.state, lastActiveDate: today, dailyGoalXp: 20, todayXp: 30 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version: 6 }));

    const { useQuizStore: store } = await import('@/store/quizStore');

    expect(store.getState().todayXp).toBe(30);
  });
});

describe('useDailyGoalProgress (spec 061)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('отдаёт долю и признак достижения по данным стора', () => {
    useQuizStore.setState({ todayXp: 15, dailyGoalXp: 20 });

    const { result } = renderHook(() => useDailyGoalProgress());

    expect(result.current.todayXp).toBe(15);
    expect(result.current.goalXp).toBe(20);
    expect(result.current.ratio).toBeCloseTo(0.75, 5);
    expect(result.current.met).toBe(false);

    act(() => {
      useQuizStore.setState({ todayXp: 20 });
    });
    expect(result.current.met).toBe(true);
  });

  it('null-цель (picker не пройден) читается как дефолт 20 XP, без NaN', () => {
    useQuizStore.setState({ todayXp: 10, dailyGoalXp: null });

    const { result } = renderHook(() => useDailyGoalProgress());

    expect(result.current.goalXp).toBe(20);
    expect(result.current.ratio).toBeCloseTo(0.5, 5);
    expect(result.current.met).toBe(false);
  });
});
