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
// The write-back stamps the CURRENT version (now 5: FSRS-lite added
// `scheduledReviews` in spec 052, онбординг добавил два поля в spec 060),
// which is what the assertions below check.
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

    // v1 is four steps behind now: the write-back stamps the current version.
    useQuizStore.setState({ streak: 1 });
    expect(readPersisted().version).toBe(5);
    // v3 → v4 создаёт реестр расписания пустым (наполняет его Dashboard/эффект).
    expect(readPersisted().state.scheduledReviews).toEqual({});
    // v4 → v5 добавляет онбординг-поля с дефолтами (spec 060).
    expect(readPersisted().state.hasCompletedOnboarding).toBe(false);
    expect(readPersisted().state.onboardingGoal).toBeNull();
  });

  it('v1 → v5: геймификация и version bump одновременно', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V1_PAYLOAD));
    const { useQuizStore } = await import('@/store/quizStore');
    const s = useQuizStore.getState();
    expect(s.streak).toBe(0);
    expect(s.lastActiveDate).toBeNull();
    expect(s.totalXp).toBe(0);
    useQuizStore.setState({ lastActiveDate: '2026-03-10' });
    const raw = readPersisted();
    expect(raw.version).toBe(5);
    expect(raw.state.lastActiveDate).toBe('2026-03-10');
  });

  it('migrated store persists the new fields under version 5', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V1_PAYLOAD));

    const { useQuizStore } = await import('@/store/quizStore');
    useQuizStore.setState({ streak: 4, totalXp: 40, lastActiveDate: '2026-03-10' });

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const parsed = JSON.parse(String(raw)) as { state: Record<string, unknown>; version: number };

    expect(parsed.version).toBe(5);
    expect(parsed.state.streak).toBe(4);
    expect(parsed.state.totalXp).toBe(40);
    expect(parsed.state.lastActiveDate).toBe('2026-03-10');
  });

  it('v2 → v5 leaves answers untouched in migrate (bank is empty there)', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V2_PAYLOAD));

    const { useQuizStore } = await import('@/store/quizStore');
    const s = useQuizStore.getState();

    // migrate cannot reach the bank, so nothing is rewritten here: the record is
    // still the v2 shape. `optionText` arrives later, from loadQuestions →
    // normalizeAnswersAgainstBank (covered in persist-answer-reorder.test.ts).
    expect(s.questions).toHaveLength(0);
    expect(s.answers).toHaveLength(1);
    expect(s.answers[0]).toEqual({ questionId: 'fp_001', selectedIndex: 0, isCorrect: true });
    expect(readPersisted().version).toBe(5);
  });

  it('v3 → v4 создаёт пустой scheduledReviews и не наполняет его банком', async () => {
    // v3-состояние: истории уже накоплены, реестра расписания ещё нет.
    const V3_PAYLOAD = {
      state: {
        answers: [{ questionId: 'fp_001', selectedIndex: 0, isCorrect: true }],
        currentIndex: 2,
        isPro: true,
        streak: 3,
        lastActiveDate: '2026-03-10',
        totalXp: 30,
        questionStats: { fp_001: { attempts: 1, correct: 1, lastAt: '2026-03-10' } },
      },
      version: 3,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(V3_PAYLOAD));

    const { useQuizStore } = await import('@/store/quizStore');
    const s = useQuizStore.getState();

    // Старая история сохраняется…
    expect(s.streak).toBe(3);
    expect(s.totalXp).toBe(30);
    expect(s.answers).toHaveLength(1);
    expect(s.questionStats.fp_001.attempts).toBe(1);
    // …а реестр расписания создаётся ПУСТЫМ: банк в migrate недоступен.
    expect(s.scheduledReviews).toEqual({});
    // Пустой реестр + пустой банк → N = 0 (до загрузки банка повторять нечего).
    expect(s.getTodayReviewIds()).toEqual([]);

    // Идемпотентность: та же запись v3 ещё раз ничего не дублирует и не добавляет.
    useQuizStore.setState({ scheduledReviews: {} });
    expect(readPersisted().version).toBe(5);
    expect(readPersisted().state.scheduledReviews).toEqual({});
  });

  it('после загрузки банка наполнение реестра идемпотентно (N = размер банка)', async () => {
    const { useQuizStore } = await import('@/store/quizStore');
    useQuizStore.setState({ scheduledReviews: {}, questions: [] });
    const bankIds = ['q1', 'q2', 'q3'];

    useQuizStore.getState().ensureReviewsInitialized(bankIds);
    const first = useQuizStore.getState().scheduledReviews;
    expect(Object.keys(first)).toEqual(bankIds);

    // Повторный вызов (как повторный рендер Dashboard) не меняет ссылку и не
    // дублирует записи — иначе эффект зациклился бы сам на себе.
    useQuizStore.getState().ensureReviewsInitialized(bankIds);
    expect(useQuizStore.getState().scheduledReviews).toBe(first);
  });

  it('a fresh store starts with gamification defaults', async () => {
    const { useQuizStore } = await import('@/store/quizStore');
    const s = useQuizStore.getState();

    expect(s.streak).toBe(0);
    expect(s.lastActiveDate).toBeNull();
    expect(s.totalXp).toBe(0);
  });
});
