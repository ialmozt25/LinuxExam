import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useQuizStore } from '@/store/quizStore';
import { XP_EXAM_COMPLETE } from '@/domain/xp';
import type { Question } from '@/data/models/Question';

/**
 * XP-механика на уровне стора: начисление, anti-farming, дневной счётчик и
 * переход через полночь.
 *
 * Домен (таблица начисления, вехи, шкала уровней) проверен отдельно в
 * `src/domain/__tests__/xp.test.ts`; здесь — ровно то, что домен решить не может:
 * КОГДА начислять (первый ответ на вопрос за день) и в какие поля писать.
 */

const TODAY = '2026-03-10';
const TOMORROW = '2026-03-11';
const YESTERDAY = '2026-03-09';

/** Верный вариант — индекс 0, как и в большинстве живого банка. */
function question(id: string): Question {
  return {
    id,
    topic: 'file_permissions',
    difficulty: 'easy',
    question: `${id}?`,
    options: [
      { text: 'A', correct: true },
      { text: 'B', correct: false },
      { text: 'C', correct: false },
      { text: 'D', correct: false },
    ],
    explanation: 'A.',
  };
}

const mockQuestions: Question[] = [question('q1'), question('q2'), question('q3')];

function resetStore() {
  useQuizStore.setState({
    questions: mockQuestions,
    answers: [],
    reviewAnswers: [],
    reviewQuestionIds: null,
    reviewKind: null,
    wrongQuestionIds: [],
    isQuizInProgress: false,
    currentIndex: 0,
    currentScreen: 'dashboard',
    activeTopic: null,
    isPaywallVisible: false,
    isPro: true,
    streak: 0,
    lastActiveDate: null,
    totalXp: 0,
    todayXp: 0,
    todayXpDate: null,
    todayAnswered: 0,
    todayAnsweredDate: null,
    answeredToday: [],
    questionStats: {},
    scheduledReviews: {},
    examSession: {
      status: 'idle',
      questionIds: [],
      answers: [],
      startedAt: null,
      durationMs: 0,
      config: null,
      finishReason: null,
    },
  });
}

/** Прогон Exam mode по переданным qid — без пресета и таймера. */
function startExam(ids: string[]) {
  useQuizStore.setState({
    examSession: {
      status: 'run',
      questionIds: ids,
      answers: [],
      startedAt: null,
      durationMs: 0,
      config: null,
      finishReason: null,
    },
  });
}

function state() {
  return useQuizStore.getState();
}

describe('XP за ответ — таблица начисления в сторе', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TODAY}T12:00:00.000Z`));
    localStorage.clear();
    resetStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('regular верный: +3 за ответ и +10 за первый ответ дня', () => {
    state().answerQuestion('q1', 0);

    const s = state();
    expect(s.totalXp).toBe(13);
    expect(s.todayXp).toBe(13);
    expect(s.todayXpDate).toBe(TODAY);
  });

  it('regular неверный: +1 за ответ и +10 за первый ответ дня', () => {
    state().answerQuestion('q1', 1);

    expect(state().totalXp).toBe(11);
  });

  it('review верный: +2 за ответ и +10 за первый ответ дня', () => {
    state().startReviewQuiz(['q1']);
    state().answerReview('q1', 0);

    expect(state().totalXp).toBe(12);
  });

  it('review неверный: +1 за ответ и +10 за первый ответ дня', () => {
    state().startReviewQuiz(['q1']);
    state().answerReview('q1', 1);

    expect(state().totalXp).toBe(11);
  });

  it('второй верный ответ (другой вопрос) платит только свою цену', () => {
    state().answerQuestion('q1', 0);
    state().answerQuestion('q2', 0);

    // (10 + 3) + 3 — повторного +10 за «первый ответ дня» нет.
    expect(state().totalXp).toBe(16);
    expect(state().todayXp).toBe(16);
  });
});

describe('anti-farming: XP платит только первый ответ на вопрос за день', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TODAY}T12:00:00.000Z`));
    localStorage.clear();
    resetStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('повторный ответ на тот же вопрос даёт 0 XP', () => {
    state().startReviewQuiz(['q1']);
    state().answerReview('q1', 0);
    const afterFirst = state().totalXp;

    // Второй ответ: пользователь передумал (в review ответ перезаписывается).
    state().answerReview('q1', 1);

    expect(state().totalXp).toBe(afterFirst);
    // Счётчик ОТВЕТОВ при этом растёт: это разные величины.
    expect(state().todayAnswered).toBe(2);
    // И статистика вопроса обновилась — anti-farming не отменяет учёт.
    expect(state().questionStats.q1.attempts).toBe(2);
  });

  it('через потоки: первый ответ в exam закрывает XP для review по тому же qid', () => {
    startExam(['q1']);
    state().submitExamAnswer('q1', 0);
    const afterExam = state().totalXp;

    state().startReviewQuiz(['q1']);
    state().answerReview('q1', 0);

    // Экзамен за ответы не платит, но «первый ответ дня» по q1 он потратил.
    expect(afterExam).toBe(10);
    expect(state().totalXp).toBe(10);
  });

  it('список «первых за день» содержит каждый вопрос ровно один раз', () => {
    state().startReviewQuiz(['q1', 'q2']);
    state().answerReview('q1', 0);
    state().answerReview('q1', 0);
    state().answerReview('q2', 0);

    expect(state().answeredToday).toEqual(['q1', 'q2']);
  });

  it('новый день возвращает XP за тот же вопрос', () => {
    state().answerQuestion('q1', 0);
    expect(state().totalXp).toBe(13);

    vi.setSystemTime(new Date(`${TOMORROW}T09:00:00.000Z`));
    state().answerQuestion('q1', 0);

    // Первый ответ нового дня: +10 серия + 3 ответ, дневной счётчик начат заново.
    expect(state().totalXp).toBe(26);
    expect(state().todayXp).toBe(13);
    expect(state().todayXpDate).toBe(TOMORROW);
    expect(state().answeredToday).toEqual(['q1']);
  });

  it('вчерашний маркер дня не считается сегодняшним: список «первых» обнуляется', () => {
    useQuizStore.setState({
      answeredToday: ['q1'],
      todayAnswered: 1,
      todayAnsweredDate: YESTERDAY,
      lastActiveDate: YESTERDAY,
      todayXp: 40,
      todayXpDate: YESTERDAY,
    });

    state().startReviewQuiz(['q1']);
    state().answerReview('q1', 0);

    // Вчерашний ответ не занимает сегодняшний слот: q1 платит как первый.
    expect(state().answeredToday).toEqual(['q1']);
    expect(state().todayXp).toBe(12);
    expect(state().todayXpDate).toBe(TODAY);
  });
});

describe('exam: платит завершение прогона, а не ответы', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TODAY}T12:00:00.000Z`));
    localStorage.clear();
    resetStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('ответы экзамена не платят, завершение — +10', () => {
    startExam(['q1', 'q2']);
    state().submitExamAnswer('q1', 0);
    state().submitExamAnswer('q2', 1);
    // +10 — первый ответ дня (серия), за сами ответы — ноль.
    expect(state().totalXp).toBe(10);

    state().finishExamSession('manual');

    expect(state().totalXp).toBe(10 + XP_EXAM_COMPLETE);
    expect(state().todayXp).toBe(20);
    expect(state().examSession.status).toBe('done');
  });

  it('повторное завершение не платит второй раз', () => {
    startExam(['q1']);
    state().submitExamAnswer('q1', 0);
    state().finishExamSession('manual');
    const afterFinish = state().totalXp;

    state().finishExamSession('timeout');

    expect(state().totalXp).toBe(afterFinish);
    // Причина первого завершения не перезаписывается.
    expect(state().examSession.finishReason).toBe('manual');
  });

  it('отменённый прогон не платит', () => {
    startExam(['q1']);
    state().submitExamAnswer('q1', 0);
    state().cancelExamSession();

    expect(state().totalXp).toBe(10); // только серия за первый ответ дня
  });
});

describe('todayXp: сброс в полночь и неубывающий totalXp', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TODAY}T12:00:00.000Z`));
    localStorage.clear();
    resetStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    localStorage.clear();
  });

  it('сессия пережила полночь: первый ответ нового дня начинает счётчик заново', () => {
    state().answerQuestion('q1', 0);
    expect(state().todayXp).toBe(13);

    // Гидратации не было — сессия живёт; день меняется лениво, на первом
    // начислении нового дня.
    vi.setSystemTime(new Date(`${TOMORROW}T00:05:00.000Z`));
    state().answerQuestion('q2', 0);

    const s = state();
    expect(s.todayXp).toBe(13);
    expect(s.todayXpDate).toBe(TOMORROW);
    // totalXp не убывает: 13 + (10 + 3).
    expect(s.totalXp).toBe(26);
  });

  it('totalXp не убывает при сбросе дневного счётчика', () => {
    state().answerQuestion('q1', 0);
    const total = state().totalXp;

    vi.setSystemTime(new Date(`${TOMORROW}T08:00:00.000Z`));
    state().resetTodayXpIfNewDay();

    expect(state().todayXp).toBe(0);
    expect(state().totalXp).toBe(total);
  });

  it('+10 за первый ответ дня начисляется один раз, в каком бы потоке он ни был', () => {
    startExam(['q1']);
    state().submitExamAnswer('q1', 0);
    expect(state().todayXp).toBe(10);

    state().startReviewQuiz(['q2']);
    state().answerReview('q2', 0);

    // +2 за review-ответ, повторного +10 нет.
    expect(state().todayXp).toBe(12);
    expect(state().streak).toBe(1);
    expect(state().lastActiveDate).toBe(TODAY);
  });
});
