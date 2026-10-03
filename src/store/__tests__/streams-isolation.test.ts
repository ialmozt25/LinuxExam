import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useQuizStore } from '../quizStore';
import type { Question } from '@/data/models/Question';

// Fixture mirrors the real bank's shape: exactly one correct option, and here
// it sits at index 0 (index 1 is the wrong-answer probe).
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
  {
    id: 'q3',
    topic: 'file_management',
    difficulty: 'easy',
    question: 'Q3?',
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
    reviewKind: null,
    examAnswers: [],
    wrongQuestionIds: [],
    reviewQuestionIds: null,
    isQuizInProgress: false,
    currentIndex: 0,
    currentScreen: 'dashboard',
    activeTopic: null,
    examActive: false,
    examStartedAt: null,
    examDurationMs: 0,
    examQuestionIds: [],
    examLastResult: null,
    isPaywallVisible: false,
    isPro: false,
    streak: 0,
    lastActiveDate: null,
    totalXp: 0,
    // Статистика и расписание тоже относятся к профилю: без сброса они текут
    // между кейсами (attempts накапливаются в одном и том же qid).
    questionStats: {},
    scheduledReviews: {},
  });
}

describe('answerReview updates wrongQuestionIds (unified rule)', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    resetStore();
  });
  afterEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('correct answer removes from wrongQuestionIds', () => {
    useQuizStore.setState({ wrongQuestionIds: ['q1', 'q2'] });
    useQuizStore.getState().startReviewQuiz(['q1']);
    useQuizStore.getState().answerReview('q1', 0);
    const s = useQuizStore.getState();
    expect(s.wrongQuestionIds).not.toContain('q1');
    expect(s.wrongQuestionIds).toContain('q2');
  });

  it('correct answer retires the question, shrinking the dashboard counter', () => {
    useQuizStore.setState({ wrongQuestionIds: ['q1', 'q2', 'q3'] });
    expect(useQuizStore.getState().wrongQuestionIds).toHaveLength(3);
    useQuizStore.getState().startReviewQuiz(['q1', 'q2', 'q3']);
    useQuizStore.getState().answerReview('q1', 0);
    expect(useQuizStore.getState().wrongQuestionIds).toHaveLength(2);
    useQuizStore.getState().answerReview('q2', 0);
    expect(useQuizStore.getState().wrongQuestionIds).toHaveLength(1);
  });

  it('wrong answer keeps question in wrongQuestionIds', () => {
    useQuizStore.setState({ wrongQuestionIds: ['q1'] });
    useQuizStore.getState().startReviewQuiz(['q1']);
    useQuizStore.getState().answerReview('q1', 1);
    expect(useQuizStore.getState().wrongQuestionIds).toContain('q1');
  });

  it('wrong answer adds if not present', () => {
    useQuizStore.setState({ wrongQuestionIds: [] });
    useQuizStore.getState().startReviewQuiz(['q1']);
    useQuizStore.getState().answerReview('q1', 1);
    expect(useQuizStore.getState().wrongQuestionIds).toContain('q1');
  });

  it('answerExam does NOT touch wrongQuestionIds', () => {
    const wrongBefore = ['q1'];
    useQuizStore.setState({ wrongQuestionIds: wrongBefore });
    useQuizStore.getState().startExam(1, 60000);
    // startExam leaves wrongQuestionIds alone; re-seed only if that ever changes.
    if (useQuizStore.getState().wrongQuestionIds.length === 0) {
      useQuizStore.setState({ wrongQuestionIds: wrongBefore });
    }
    useQuizStore.getState().answerExam('q1', 0);
    expect(useQuizStore.getState().wrongQuestionIds).toEqual(wrongBefore);
  });

  it('does not rewrite wrongQuestionIds when membership is unchanged', () => {
    useQuizStore.setState({ wrongQuestionIds: ['q1'] });
    useQuizStore.getState().startReviewQuiz(['q1']);
    const before = useQuizStore.getState().wrongQuestionIds;
    useQuizStore.getState().answerReview('q1', 1);
    expect(useQuizStore.getState().wrongQuestionIds).toBe(before);
  });
});

describe('FSRS-lite: расписание пишет только прогон «Повторить сегодня»', () => {
  // Свежее состояние перед каждым кейсом: и реестр расписания, и review-стрим
  // сбрасываются, чтобы кейсы не делили между собой профиль.
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    resetStore();
    useQuizStore.setState({ scheduledReviews: {} });
  });
  afterEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('после ответа в прогоне сегодня N уменьшается на 1, next уходит в будущее', () => {
    const before = Date.now();
    useQuizStore.getState().startReviewQuiz(['q1', 'q2'], 'today');
    // Записей нет ни у одного вопроса банка → все три — новые (spec 065:
    // отсутствие записи больше не значит «пора повторить»).
    expect(useQuizStore.getState().getSessionIds()).toEqual(['q1', 'q2', 'q3']);
    expect(useQuizStore.getState().getSessionCounts()).toEqual({ newCount: 3, dueCount: 0 });

    useQuizStore.getState().answerReview('q1', 0); // 0 = правильный вариант

    const record = useQuizStore.getState().scheduledReviews.q1;
    expect(record).toBeDefined();
    expect(record.next).toBeGreaterThanOrEqual(before); // вопрос вышел из N
    expect(record.stability).toBe(1.5); // Good → stability × 1.5
    // Запись есть и next > now: вопрос не в due и не в new — он просто не в сессии.
    expect(useQuizStore.getState().getSessionIds()).toEqual(['q2', 'q3']);
    expect(useQuizStore.getState().getSessionCounts()).toEqual({ newCount: 2, dueCount: 0 });
    // Ответ при этом остался в review-стриме и ушёл в статистику.
    expect(useQuizStore.getState().reviewAnswers).toHaveLength(1);
    expect(useQuizStore.getState().questionStats.q1.attempts).toBe(1);
  });

  it('просроченная запись попадает в due и идёт раньше новых', () => {
    const now = Date.now();
    useQuizStore.setState({
      scheduledReviews: {
        q3: { next: now - 1000, stability: 1, difficulty: 0.3 },
        q1: { next: now + 86400000, stability: 1, difficulty: 0.3 },
      },
    });
    // q3 просрочен (due), q2 без записи (new), q1 запланирован в будущем.
    expect(useQuizStore.getState().getSessionCounts()).toEqual({ newCount: 1, dueCount: 1 });
    expect(useQuizStore.getState().getSessionIds()).toEqual(['q3', 'q2']);
  });

  it('getSessionIds уважает лимит и умеет отдать пустую сессию', () => {
    useQuizStore.setState({ scheduledReviews: {} });
    expect(useQuizStore.getState().getSessionIds(2)).toEqual(['q1', 'q2']);
    expect(useQuizStore.getState().getSessionIds(0)).toEqual([]);
    expect(useQuizStore.getState().getSessionIds()).toHaveLength(mockQuestions.length);
  });

  it('неверный ответ опускает stability и тоже выводит вопрос из N', () => {
    const before = Date.now();
    useQuizStore.setState({ scheduledReviews: {} });
    useQuizStore.setState({ questions: [mockQuestions[0]] });
    useQuizStore.getState().startReviewQuiz(['q1'], 'today');
    expect(useQuizStore.getState().getSessionIds()).toEqual(['q1']);

    useQuizStore.getState().answerReview('q1', 1); // 1 = неверный вариант

    const record = useQuizStore.getState().scheduledReviews.q1;
    expect(record.stability).toBe(0.5); // Again → stability × 0.5
    expect(record.difficulty).toBeCloseTo(0.4, 10); // 0.3 + 0.10
    expect(record.next).toBeGreaterThan(before);
    expect(useQuizStore.getState().getSessionIds()).toEqual([]);
    expect(useQuizStore.getState().getSessionCounts()).toEqual({ newCount: 0, dueCount: 0 });
  });

  it('обычный прогон ошибок и регулярный поток расписание не трогают', () => {
    // kind не передан → это «Повторить ошибки», расписание не пишется.
    useQuizStore.setState({ wrongQuestionIds: ['q1'] });
    useQuizStore.getState().startReviewQuiz(['q1']);
    useQuizStore.getState().answerReview('q1', 0);
    expect(useQuizStore.getState().scheduledReviews).toEqual({});

    // Регулярный поток и экзамен — тоже. currentIndex=1 → это q2, чтобы ответ
    // прошёл гейт canAccessQuestion (FREE_QUESTION_LIMIT).
    useQuizStore.getState().startRegularQuiz();
    useQuizStore.setState({ currentIndex: 1 });
    useQuizStore.getState().answerQuestion('q2', 0);
    useQuizStore.getState().startExam(1, 60000);
    useQuizStore.getState().answerExam('q2', 0);
    expect(useQuizStore.getState().scheduledReviews).toEqual({});
    // …и сессия по-прежнему состоит из всего банка: записей нет = все новые.
    expect(useQuizStore.getState().getSessionIds()).toHaveLength(mockQuestions.length);
    expect(useQuizStore.getState().getSessionCounts()).toEqual({
      newCount: mockQuestions.length,
      dueCount: 0,
    });
  });
});
