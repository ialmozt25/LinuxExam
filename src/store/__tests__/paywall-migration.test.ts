import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const STORAGE_KEY = 'rhcsa_progress';

/**
 * v6-состояние (spec 061): ровно те 21 поле, которые персистит `partialize` на
 * версии 6. Поля paywall (`trialStartedAt`) ещё нет — его добавляет миграция
 * v6 → v7 (spec 063).
 */
const V6_PAYLOAD = {
  state: {
    answers: [{ questionId: 'fp_001', selectedIndex: 0, isCorrect: true, optionText: 'A' }],
    currentIndex: 3,
    isPro: false,
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
  },
  version: 6,
};

/** Тот же payload, но профиль ещё не проходил онбординг (новый пользователь). */
const V6_FRESH = {
  state: {
    ...V6_PAYLOAD.state,
    hasCompletedOnboarding: false,
    onboardingGoal: null,
    questionStats: {},
    answers: [],
    currentIndex: 0,
    streak: 0,
    totalXp: 0,
    todayXp: 0,
    wrongQuestionIds: [],
    scheduledReviews: {},
    reviewQuestionIds: null,
    isQuizInProgress: false,
  },
  version: 6,
};

/** Тот же payload, но Pro уже куплен: trial такому профилю не нужен. */
const V6_PRO = {
  state: { ...V6_PAYLOAD.state, isPro: true },
  version: 6,
};

function readPersisted(): { state: Record<string, unknown>; version: number } {
  return JSON.parse(String(localStorage.getItem(STORAGE_KEY))) as {
    state: Record<string, unknown>;
    version: number;
  };
}

describe('persist migration v6 → v7 (paywall, spec 063)', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('существующий пользователь (онбординг пройден, !isPro) получает trial', async () => {
    const now = 1_800_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V6_PAYLOAD));

    const { useQuizStore } = await import('@/store/quizStore');
    const s = useQuizStore.getState();

    expect(s.trialStartedAt).toBe(now);
    // `isPro` миграция не трогает.
    expect(s.isPro).toBe(false);

    // Legacy-поля инлайн-экзамена удалены spec 068, остальные поля на месте и не
    // перезаписаны дефолтами.
    expect(s.answers).toHaveLength(1);
    expect(s.answers[0].questionId).toBe('fp_001');
    expect(s.currentIndex).toBe(3);
    expect(s.streak).toBe(5);
    expect(s.lastActiveDate).toBe('2026-10-01');
    expect(s.totalXp).toBe(50);
    expect(s.wrongQuestionIds).toEqual(['fp_002']);
    expect(s.questionStats.fp_001.attempts).toBe(2);
    expect(s.scheduledReviews.fp_001.stability).toBe(1.5);
    expect(s.reviewQuestionIds).toEqual(['fp_001']);
    expect(s.isQuizInProgress).toBe(true);
    expect(s.onboardingGoal).toBe('rhcsa');
    expect(s.hasCompletedOnboarding).toBe(true);
    expect(s.dailyGoalXp).toBe(30);
    // todayXp в v6-payload — 10, но гидратация сверяет день: lastActiveDate
    // профиля ('2026-10-01') не сегодняшний, поэтому дневной счётчик обнулён
    // (`resetTodayXpIfNewDay`; маркер `todayXpDate` миграция v7→v8 берёт из
    // `lastActiveDate`, поэтому день читается ровно как до обновления).
    expect(s.todayXp).toBe(0);
  });

  it('новый пользователь (онбординг не пройден) trial НЕ получает', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V6_FRESH));

    const { useQuizStore } = await import('@/store/quizStore');
    const s = useQuizStore.getState();

    expect(s.trialStartedAt).toBeNull();
    expect(s.hasCompletedOnboarding).toBe(false);
    expect(s.isPro).toBe(false);
  });

  it('пользователь с купленным Pro trial не получает', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V6_PRO));

    const { useQuizStore } = await import('@/store/quizStore');
    const s = useQuizStore.getState();

    expect(s.trialStartedAt).toBeNull();
    expect(s.isPro).toBe(true);
  });

  it('свежий store стартует без trial и с isPro = false', async () => {
    const { useQuizStore } = await import('@/store/quizStore');
    const s = useQuizStore.getState();
    expect(s.trialStartedAt).toBeNull();
    expect(s.isPro).toBe(false);
  });

  it('записывает состояние под версией 8, поля XP-механики — в конце partialize', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V6_PAYLOAD));
    const { useQuizStore } = await import('@/store/quizStore');

    useQuizStore.setState({ trialStartedAt: 1_800_000_000_000 });

    const raw = readPersisted();
    expect(raw.version).toBe(8);
    expect(raw.state.trialStartedAt).toBe(1_800_000_000_000);
    // Контракт partialize: каждое новое поле дописывается в КОНЕЦ, порядок
    // предыдущих не меняется. spec 068 убрал 5 legacy-полей инлайн-экзамена
    // (ключей стало 17), «счётчик ответов за сегодня» дописал два
    // (`todayAnswered`, `todayAnsweredDate`) — стало 19, XP-механика дописала
    // ещё два (`todayXpDate`, `answeredToday`) — стало 21.
    const stateKeys = Object.keys(raw.state);
    expect(stateKeys[stateKeys.length - 1]).toBe('answeredToday');
    expect(stateKeys[stateKeys.length - 2]).toBe('todayXpDate');
    expect(stateKeys[stateKeys.length - 3]).toBe('todayAnsweredDate');
    expect(stateKeys[stateKeys.length - 4]).toBe('todayAnswered');
    expect(stateKeys[stateKeys.length - 5]).toBe('trialStartedAt');
    expect(stateKeys[stateKeys.length - 6]).toBe('todayXp');
    expect(stateKeys).toHaveLength(21);
  });

  it('состояние уже v7 проходит migrate как no-op (trial не переставляется)', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V6_PAYLOAD));
    const { useQuizStore } = await import('@/store/quizStore');
    const started = useQuizStore.getState().trialStartedAt;
    expect(started).not.toBeNull();

    const v7 = readPersisted();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v7));

    vi.resetModules();
    const again = await import('@/store/quizStore');
    expect(again.useQuizStore.getState().trialStartedAt).toBe(started);
  });
});

describe('startTrial (spec 063)', () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
  });

  it('стартует trial, если он ещё не начинался', async () => {
    const now = 1_800_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(now);
    const { useQuizStore } = await import('@/store/quizStore');

    expect(useQuizStore.getState().trialStartedAt).toBeNull();
    useQuizStore.getState().startTrial();
    expect(useQuizStore.getState().trialStartedAt).toBe(now);
  });

  it('идемпотентен: повторный вызов не отодвигает дату старта', async () => {
    const first = 1_800_000_000_000;
    vi.spyOn(Date, 'now').mockReturnValue(first);
    const { useQuizStore } = await import('@/store/quizStore');

    useQuizStore.getState().startTrial();
    expect(useQuizStore.getState().trialStartedAt).toBe(first);

    // Через день кнопку нажали снова — срок НЕ продлевается.
    vi.spyOn(Date, 'now').mockReturnValue(first + 24 * 3600 * 1000);
    useQuizStore.getState().startTrial();
    expect(useQuizStore.getState().trialStartedAt).toBe(first);
  });

  it('не включает Pro и не закрывает paywall сам по себе', async () => {
    const { useQuizStore } = await import('@/store/quizStore');
    useQuizStore.setState({ isPro: false, isPaywallVisible: true });

    useQuizStore.getState().startTrial();

    expect(useQuizStore.getState().isPro).toBe(false);
    expect(useQuizStore.getState().isPaywallVisible).toBe(true);
  });
});
