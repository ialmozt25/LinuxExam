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

/**
 * v7-состояние: ровно те 19 полей, которые персистил `partialize` на версии 7.
 * Полей XP-механики (`todayXpDate`, `answeredToday`) ещё нет — их добавляет
 * миграция v7 → v8.
 */
const V7_PAYLOAD = {
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
    onboardingGoal: 'rhcsa',
    hasCompletedOnboarding: true,
    dailyGoalXp: 20,
    todayXp: 10,
    trialStartedAt: null,
    todayAnswered: 3,
    todayAnsweredDate: '2026-10-01',
  },
  version: 7,
};

describe('persist migration v7 → v8 (XP-механика)', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('добавляет поля XP-механики и не теряет накопленное', async () => {
    const today = new Date().toISOString().slice(0, 10);
    // lastActiveDate — СЕГОДНЯШНИЙ: миграция переносит день в `todayXpDate`, и
    // гидратация видит сегодняшний маркер, поэтому накопленный todayXp остаётся.
    const payload = {
      ...V7_PAYLOAD,
      state: { ...V7_PAYLOAD.state, lastActiveDate: today, todayAnsweredDate: today },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

    const { useQuizStore: store } = await import('@/store/quizStore');
    const s = store.getState();

    // Маркер дня берётся из прежнего признака: до XP-механики день дневного
    // счётчика определялся именно по `lastActiveDate`.
    expect(s.todayXpDate).toBe(today);
    expect(s.todayXp).toBe(10);
    // anti-farming начинается с чистого листа: «первых за день» ответов у
    // обновившегося профиля нет.
    expect(s.answeredToday).toEqual([]);

    // Прежние поля не перезаписаны дефолтами.
    expect(s.streak).toBe(5);
    expect(s.totalXp).toBe(50);
    expect(s.lastActiveDate).toBe(today);
    expect(s.todayAnswered).toBe(3);
    expect(s.todayAnsweredDate).toBe(today);
  });

  it('вчерашний день из миграции гидратация обнуляет (todayXp не «переезжает»)', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V7_PAYLOAD));

    const { useQuizStore: store } = await import('@/store/quizStore');
    const s = store.getState();

    // lastActiveDate профиля — 2026-10-01, то есть не сегодня: миграция честно
    // ставит этот день маркером, а `resetTodayXpIfNewDay` на гидратации его
    // сбрасывает. Иначе вчерашний todayXp читался бы как сегодняшний.
    expect(s.todayXp).toBe(0);
    expect(s.todayXpDate).toBeNull();
  });

  it('прежний дефолт цели (20) переводится в новый (30)', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V7_PAYLOAD));

    const { useQuizStore: store } = await import('@/store/quizStore');

    expect(store.getState().dailyGoalXp).toBe(30);
  });

  it('явный выбор пресета миграция не перезаписывает', async () => {
    const explicit = {
      ...V7_PAYLOAD,
      state: { ...V7_PAYLOAD.state, dailyGoalXp: 10 },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(explicit));

    const { useQuizStore: store } = await import('@/store/quizStore');

    expect(store.getState().dailyGoalXp).toBe(10);
  });

  it('null (picker не пройден) сохраняется — обновление не закрывает picker', async () => {
    const pickerPending = {
      ...V7_PAYLOAD,
      state: { ...V7_PAYLOAD.state, dailyGoalXp: null },
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(pickerPending));

    const { useQuizStore: store } = await import('@/store/quizStore');

    expect(store.getState().dailyGoalXp).toBeNull();
  });

  it('повторный проход по состоянию v8 ничего не меняет', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V7_PAYLOAD));
    const { useQuizStore: store } = await import('@/store/quizStore');

    const v8 = readPersisted();
    expect(v8.version).toBe(8);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v8));

    vi.resetModules();
    const again = await import('@/store/quizStore');
    expect(again.useQuizStore.getState().dailyGoalXp).toBe(30);
    expect(again.useQuizStore.getState().streak).toBe(5);
    expect(again.useQuizStore.getState().totalXp).toBe(50);
  });
});

describe('persist migration v5 → v6 (retention, spec 061)', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('добавляет retention-поля с дефолтами и сохраняет старые поля', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V5_PAYLOAD));

    const { useQuizStore: store } = await import('@/store/quizStore');
    const s = store.getState();

    // Новые поля с дефолтами: цель 30 XP (XP-механика подняла дефолт с 20),
    // дневной счётчик пуст.
    expect(s.dailyGoalXp).toBe(30);
    expect(s.todayXp).toBe(0);

    // Прежние поля на месте и не перезаписаны дефолтами. Legacy-поля
    // инлайн-экзамена удалены из состояния spec 068.
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
    expect(s.onboardingGoal).toBe('rhcsa');
    expect(s.hasCompletedOnboarding).toBe(true);
  });

  it('пишет состояние под версией 8, включая оба retention-поля', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V5_PAYLOAD));
    const { useQuizStore: store } = await import('@/store/quizStore');

    store.setState({ todayXp: 15 });

    const raw = readPersisted();
    // Версия на запись — текущая (8 с XP-механики: todayXpDate + answeredToday).
    expect(raw.version).toBe(8);
    expect(raw.state.dailyGoalXp).toBe(30);
    expect(raw.state.todayXp).toBe(15);
    expect(raw.state.onboardingGoal).toBe('rhcsa');
  });

  it('свежий store: цель не подтверждена (null → picker), дневной счётчик 0', () => {
    const s = useQuizStore.getState();
    expect(s.dailyGoalXp).toBeNull();
    expect(s.todayXp).toBe(0);
  });

  it('миграция идемпотентна: повторный проход не дублирует и не сбрасывает выбор', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V5_PAYLOAD));
    const { useQuizStore: store } = await import('@/store/quizStore');

    store.getState().setDailyGoal(30);
    const migrated = readPersisted();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(migrated));

    const again = await import('@/store/quizStore');
    // Состояние уже текущей версии: тот же payload проходит migrate как no-op.
    expect(again.useQuizStore.getState().dailyGoalXp).toBe(30);
    expect(again.useQuizStore.getState().todayXp).toBe(0);
  });
});

describe('setDailyGoal (spec 061)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('обновляет store и снимает null (picker больше не показывается)', () => {
    useQuizStore.setState({ dailyGoalXp: null });
    useQuizStore.getState().setDailyGoal(30);

    expect(useQuizStore.getState().dailyGoalXp).toBe(30);
  });

  it('принимает любой из трёх пресетов', () => {
    for (const xp of [10, 20, 30]) {
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

describe('resetTodayXpIfNewDay', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('todayXpDate != today → todayXp = 0 и маркер снят', () => {
    vi.setSystemTime(new Date('2026-03-11T08:00:00.000Z'));
    useQuizStore.setState({ todayXpDate: '2026-03-10', lastActiveDate: '2026-03-10', todayXp: 30 });

    useQuizStore.getState().resetTodayXpIfNewDay();

    const s = useQuizStore.getState();
    expect(s.todayXp).toBe(0);
    expect(s.todayXpDate).toBeNull();
  });

  it('todayXpDate == today → значение не трогается', () => {
    vi.setSystemTime(new Date('2026-03-10T08:00:00.000Z'));
    useQuizStore.setState({ todayXpDate: '2026-03-10', lastActiveDate: '2026-03-10', todayXp: 30 });

    useQuizStore.getState().resetTodayXpIfNewDay();

    const s = useQuizStore.getState();
    expect(s.todayXp).toBe(30);
    expect(s.todayXpDate).toBe('2026-03-10');
  });

  it('день считается по todayXpDate, а не по lastActiveDate', () => {
    // Профиль набрал XP сегодня, но firstAnswerOfDay ещё не было: lastActiveDate
    // остался вчерашним (XP начислялся в review/exam, `recordActivity` их не
    // двигает). Прежний признак обнулил бы сегодняшний счётчик.
    vi.setSystemTime(new Date('2026-03-10T08:00:00.000Z'));
    useQuizStore.setState({ todayXpDate: '2026-03-10', lastActiveDate: '2026-03-09', todayXp: 30 });

    useQuizStore.getState().resetTodayXpIfNewDay();

    expect(useQuizStore.getState().todayXp).toBe(30);
  });

  it('маркера нет (свежий профиль) → не трогается: счётчик уже нулевой', () => {
    vi.setSystemTime(new Date('2026-03-10T08:00:00.000Z'));
    useQuizStore.setState({ todayXpDate: null, lastActiveDate: null, todayXp: 0 });

    useQuizStore.getState().resetTodayXpIfNewDay();

    const s = useQuizStore.getState();
    expect(s.todayXp).toBe(0);
    expect(s.todayXpDate).toBeNull();
  });

  it('гидратация в новый день обнуляет todayXp автоматически (onRehydrateStorage)', async () => {
    vi.resetModules();
    // Запись ПРЕДЫДУЩЕЙ версии со вчерашним днём и накопленным счётчиком:
    // миграция v7→v8 переносит день из `lastActiveDate` (todayXpDate = вчера),
    // значит обнулить todayXp обязан onRehydrateStorage.
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const state = { ...V5_PAYLOAD.state, lastActiveDate: yesterday, dailyGoalXp: 20, todayXp: 30 };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version: 7 }));

    const { useQuizStore: store } = await import('@/store/quizStore');

    expect(store.getState().todayXp).toBe(0);
    // Остальные поля вчерашней сессии поднялись нетронутыми (цель 20 миграция
    // v7→v8 переводит на новый дефолт 30 — см. отдельный тест ниже).
    expect(store.getState().streak).toBe(5);
  });

  it('гидратация в тот же день не трогает todayXp', async () => {
    vi.resetModules();
    const today = new Date().toISOString().slice(0, 10);
    const state = {
      ...V5_PAYLOAD.state,
      lastActiveDate: today,
      dailyGoalXp: 30,
      todayXp: 30,
      todayXpDate: today,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, version: 8 }));

    const { useQuizStore: store } = await import('@/store/quizStore');

    expect(store.getState().todayXp).toBe(30);
    expect(store.getState().todayXpDate).toBe(today);
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

  it('null-цель (picker не пройден) читается как дефолт 30 XP, без NaN', () => {
    useQuizStore.setState({ todayXp: 15, dailyGoalXp: null });

    const { result } = renderHook(() => useDailyGoalProgress());

    expect(result.current.goalXp).toBe(30);
    expect(result.current.ratio).toBeCloseTo(0.5, 5);
    expect(result.current.met).toBe(false);
  });
});
