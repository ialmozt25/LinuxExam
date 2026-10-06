import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { useQuizStore } from '../quizStore';
import type { Question } from '@/data/models/Question';

/**
 * Дневной счётчик ответов — правая часть CTA на Dashboard (задание «счётчик
 * ответов за сегодня»): N — число ОТВЕТОВ за календарный день, сброс в полночь.
 *
 * Контракт, который здесь зафиксирован:
 *
 *  - считаются ответы ВСЕХ трёх потоков (regular / review / exam): инкремент
 *    живёт в единственной воронке `recordQuestionStat`, через которую проходит
 *    каждый ответ, поэтому N не зависит от того, каким потоком отвечали;
 *  - `todayXp` для этой роли не годится (и потому не переиспользован): с
 *    XP-механикой величины расходятся ещё сильнее — повторный ответ на вопрос
 *    даёт 0 XP, ответ экзамена не даёт XP вообще, а +10 за первый ответ дня
 *    приходится на один ответ из многих;
 *  - день определяется маркером `todayAnsweredDate`, а не `lastActiveDate`:
 *    последний двигает только первый ответ дня, поэтому день «из одних review»
 *    по нему не опознаётся — и сброс на гидратации стёр бы ответы текущего дня
 *    при перезагрузке.
 */

const TODAY = '2026-03-10';
const TOMORROW = '2026-03-11';
const YESTERDAY = '2026-03-09';

// Fixture повторяет форму живого банка: ровно один верный вариант (индекс 0).
const mockQuestions: Question[] = [
  {
    id: 'q1',
    topic: 'file_permissions',
    difficulty: 'easy',
    question: 'Q1?',
    options: [
      { text: 'A', correct: true },
      { text: 'B', correct: false },
      { text: 'C', correct: false },
      { text: 'D', correct: false },
    ],
    explanation: 'A.',
  },
  {
    id: 'q2',
    topic: 'file_permissions',
    difficulty: 'easy',
    question: 'Q2?',
    options: [
      { text: 'A', correct: true },
      { text: 'B', correct: false },
      { text: 'C', correct: false },
      { text: 'D', correct: false },
    ],
    explanation: 'A.',
  },
];

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

/** Один прогон Exam mode по одному вопросу — без пресета банка. */
function startOneQuestionExam() {
  useQuizStore.setState({
    examSession: {
      status: 'run',
      questionIds: ['q1'],
      answers: [],
      startedAt: null,
      durationMs: 0,
      config: null,
      finishReason: null,
    },
  });
}

describe('дневной счётчик ответов (CTA «N из 30 вопросов»)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(`${TODAY}T12:00:00.000Z`));
    if (typeof localStorage !== 'undefined') localStorage.clear();
    resetStore();
  });

  afterEach(() => {
    vi.useRealTimers();
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('regular: каждый ответ — +1, дата дня проставляется', () => {
    useQuizStore.getState().answerQuestion('q1', 0);
    useQuizStore.getState().answerQuestion('q2', 0);

    const s = useQuizStore.getState();
    expect(s.todayAnswered).toBe(2);
    expect(s.todayAnsweredDate).toBe(TODAY);
    // Два верных ответа — это +3 +3, плюс +10 за первый ответ дня: счётчик
    // ответов и XP — разные величины (N = 2, XP = 16).
    expect(s.todayXp).toBe(16);
  });

  it('review: ответ считается, хотя firstAnswerOfDay приходит из другого потока', () => {
    useQuizStore.getState().startReviewQuiz(['q1']);
    useQuizStore.getState().answerReview('q1', 0);

    const s = useQuizStore.getState();
    expect(s.todayAnswered).toBe(1);
    expect(s.todayAnsweredDate).toBe(TODAY);
    // review платит за ответ (+2 за верный) и, как первый ответ дня, заводит
    // серию (+10). Счётчик ответов живёт независимо от обеих величин.
    expect(s.todayXp).toBe(12);
    expect(s.lastActiveDate).toBe(TODAY);
    expect(s.streak).toBe(1);
  });

  it('exam: ответ считается', () => {
    startOneQuestionExam();
    useQuizStore.getState().submitExamAnswer('q1', 0);

    const s = useQuizStore.getState();
    expect(s.todayAnswered).toBe(1);
    expect(s.todayAnsweredDate).toBe(TODAY);
    // За ответы экзамена XP не платят (+10 платит ЗАВЕРШЕНИЕ прогона), но
    // первый ответ дня в любом потоке заводит серию: 0 + 10 = 10.
    expect(s.todayXp).toBe(10);
    // И anti-farming закрыт по этому qid: повторный ответ на q1 сегодня (в
    // review) XP уже не даст — «первый ответ за день» потрачен.
    expect(s.answeredToday).toEqual(['q1']);
    useQuizStore.getState().startReviewQuiz(['q1']);
    useQuizStore.getState().answerReview('q1', 0);
    expect(useQuizStore.getState().todayXp).toBe(10);
  });

  it('повторный ответ на тот же вопрос считается как ещё один ответ', () => {
    useQuizStore.getState().startReviewQuiz(['q1', 'q2']);
    useQuizStore.getState().answerReview('q1', 0);
    useQuizStore.getState().answerReview('q1', 0);

    expect(useQuizStore.getState().todayAnswered).toBe(2);
  });

  it('сброс в полночь: гидратация в новый день обнуляет счётчик', () => {
    useQuizStore.setState({
      todayAnswered: 7,
      todayAnsweredDate: YESTERDAY,
      answeredToday: ['q1'],
      lastActiveDate: YESTERDAY,
      todayXp: 10,
      todayXpDate: YESTERDAY,
    });

    useQuizStore.getState().resetTodayXpIfNewDay();

    const s = useQuizStore.getState();
    expect(s.todayAnswered).toBe(0);
    expect(s.todayAnsweredDate).toBeNull();
    expect(s.answeredToday).toEqual([]);
    expect(s.todayXp).toBe(0);
    expect(s.todayXpDate).toBeNull();
  });

  it('тот же день: сброс идемпотентен', () => {
    useQuizStore.setState({
      todayAnswered: 7,
      todayAnsweredDate: TODAY,
      answeredToday: ['q1'],
      lastActiveDate: TODAY,
      todayXp: 10,
      todayXpDate: TODAY,
    });

    useQuizStore.getState().resetTodayXpIfNewDay();

    const s = useQuizStore.getState();
    expect(s.todayAnswered).toBe(7);
    expect(s.todayAnsweredDate).toBe(TODAY);
    expect(s.answeredToday).toEqual(['q1']);
    expect(s.todayXp).toBe(10);
  });

  it('день «из одних review» переживает перезагрузку (lastActiveDate его не двигает)', () => {
    // Так выглядит профиль, который сегодня отвечал только в review: счётчик и
    // его маркер — сегодняшние, а lastActiveDate остался вчерашним.
    useQuizStore.setState({
      todayAnswered: 5,
      todayAnsweredDate: TODAY,
      lastActiveDate: YESTERDAY,
      todayXp: 0,
    });

    useQuizStore.getState().resetTodayXpIfNewDay();

    expect(useQuizStore.getState().todayAnswered).toBe(5);
    expect(useQuizStore.getState().todayAnsweredDate).toBe(TODAY);
  });

  it('сессия пережила полночь: первый ответ нового дня начинает счётчик заново', () => {
    useQuizStore.setState({ todayAnswered: 20, todayAnsweredDate: YESTERDAY });
    vi.setSystemTime(new Date(`${TOMORROW}T00:05:00.000Z`));

    useQuizStore.getState().answerQuestion('q1', 0);

    const s = useQuizStore.getState();
    expect(s.todayAnswered).toBe(1);
    expect(s.todayAnsweredDate).toBe(TOMORROW);
  });
});
