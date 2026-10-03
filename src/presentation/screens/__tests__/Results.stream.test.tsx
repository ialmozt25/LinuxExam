import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import Results from '@/presentation/screens/Results';
import { useQuizStore } from '@/store/quizStore';

// Results must report the ACTIVE answer stream, resolved with the same
// precedence as Question.tsx: exam > review > regular. The original defect was
// Results always reading the regular stream, so a finished topic/review run
// reported "Вы ещё не ответили ни на один вопрос".

function resetStore() {
  useQuizStore.setState({
    answers: [],
    reviewAnswers: [],
    examAnswers: [],
    wrongQuestionIds: [],
    reviewQuestionIds: null,
    isQuizInProgress: false,
    currentIndex: 0,
    currentScreen: 'results',
    activeTopic: null,
    examActive: false,
    examStartedAt: null,
    examDurationMs: 0,
    examQuestionIds: [],
    examLastResult: null,
    isPaywallVisible: false,
    isPro: true,
    streak: 0,
    lastActiveDate: null,
    totalXp: 0,
    // spec 065: «Ещё 30» считается по реестру расписания, поэтому он тоже
    // относится к профилю — без сброса он течёт между кейсами.
    scheduledReviews: {},
    questionStats: {},
  });
}

const right = (questionId: string) => ({
  questionId,
  selectedIndex: 0,
  isCorrect: true,
  optionText: `${questionId} option 0`,
});
const wrong = (questionId: string) => ({
  questionId,
  selectedIndex: 1,
  isCorrect: false,
  optionText: `${questionId} option 1`,
});

describe('Results reads the active stream', () => {
  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    await useQuizStore.getState().loadQuestions();
    resetStore();
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('review without any regular answers reports the review stream, not empty', () => {
    const [q1, q2] = useQuizStore.getState().questions;
    useQuizStore.setState({
      answers: [],
      reviewQuestionIds: [q1.id, q2.id],
      reviewAnswers: [right(q1.id), right(q2.id)],
      // No activeTopic: this is "Повторить ошибки", not a topic quiz.
      activeTopic: null,
    });

    render(<Results />);

    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(screen.queryByText('Вы ещё не ответили ни на один вопрос')).toBeNull();
    expect(screen.getByText(/Правильных из 2 вопрос/)).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Результаты повторения');
  });

  it('a topic review is titled with the topic name', () => {
    const [q1, q2] = useQuizStore.getState().questions;
    useQuizStore.setState({
      reviewQuestionIds: [q1.id, q2.id],
      reviewAnswers: [right(q1.id), wrong(q2.id)],
      activeTopic: 'file_permissions',
    });

    render(<Results />);

    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Тема: Права доступа');
    expect(screen.getByText('1 / 2')).toBeTruthy();
    expect(screen.getByText('50%')).toBeTruthy();
    // The per-topic breakdown counts the active stream too: 2 of this topic's
    // questions were graded (one correct), not 0/N while the card says 1/2.
    // The denominator is read from the loaded bank with the same rule as
    // Results.tsx (topicQuestions.length), so growing the topic cannot break
    // this test the way a hardcoded constant would.
    const topicTotal = useQuizStore
      .getState()
      .questions.filter((q) => q.topic === 'file_permissions').length;
    expect(screen.getByText(`1/${topicTotal}`)).toBeTruthy();
  });

  it('regular after a review reads the regular stream, not the review one', () => {
    const [q1, q2, q3] = useQuizStore.getState().questions;
    // The stale review leftover is deliberately LONGER than the regular stream,
    // so reading the wrong stream would show 2/3 instead of 2/2.
    useQuizStore.setState({
      answers: [right(q1.id), right(q2.id)],
      reviewQuestionIds: null,
      reviewAnswers: [right(q1.id), wrong(q2.id), wrong(q3.id)],
      activeTopic: null,
    });

    render(<Results />);

    expect(screen.getByText('2 / 2')).toBeTruthy();
    expect(screen.queryByText('2 / 3')).toBeNull();
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe('Результаты');
    // "Пройти заново" is the regular-stream affordance and must be present here.
    expect(screen.getByRole('button', { name: 'Пройти заново' })).toBeTruthy();
  });

  it('a review hides "Пройти заново" but keeps "К темам"', () => {
    const [q1, q2] = useQuizStore.getState().questions;
    useQuizStore.setState({
      reviewQuestionIds: [q1.id, q2.id],
      reviewAnswers: [right(q1.id), right(q2.id)],
      activeTopic: 'file_permissions',
    });

    render(<Results />);

    expect(screen.queryByRole('button', { name: 'Пройти заново' })).toBeNull();
    expect(screen.getByRole('button', { name: 'К темам' })).toBeTruthy();
  });

  it('a review does not offer the wrong-answer review entry point again', () => {
    const [q1, q2] = useQuizStore.getState().questions;
    useQuizStore.setState({
      reviewQuestionIds: [q1.id, q2.id],
      reviewAnswers: [right(q1.id), wrong(q2.id)],
      wrongQuestionIds: [q2.id],
      activeTopic: 'file_permissions',
    });

    render(<Results />);

    expect(screen.queryByRole('button', { name: /Повторить ошибки/ })).toBeNull();
  });

  it('«Ещё 30» появляется в прогоне, когда остались непройденные вопросы (spec 065)', () => {
    const bank = useQuizStore.getState().questions;
    const [q1, q2] = bank;
    // Две карточки текущей сессии уже отвечены → их `next` в будущем, и
    // getSessionIds() отдаёт остальной банк. Кнопка не должна предлагать
    // вопросы, которые пользователь уже прошёл в этом прогоне.
    const seen = { next: Date.now() + 86_400_000, stability: 1, difficulty: 0.3 };
    useQuizStore.setState({
      scheduledReviews: { [q1.id]: seen, [q2.id]: seen },
      reviewQuestionIds: [q1.id, q2.id],
      reviewAnswers: [right(q1.id), right(q2.id)],
      activeTopic: null,
    });

    render(<Results />);

    const next = screen.getByTestId('review-next-batch');
    // Остаток — не весь банк: отвеченные исключены, а размер сессии ограничен.
    const remaining = bank.length - 2;
    expect(next.textContent).toContain(`Ещё ${Math.min(remaining, 30)}`);
  });

  it('«Ещё 30» не появляется в регулярном потоке', () => {
    const [q1, q2] = useQuizStore.getState().questions;
    useQuizStore.setState({
      scheduledReviews: {},
      answers: [right(q1.id), right(q2.id)],
      reviewQuestionIds: null,
      reviewAnswers: [],
      activeTopic: null,
    });

    render(<Results />);

    expect(screen.queryByTestId('review-next-batch')).toBeNull();
  });

  it('«Ещё 30» не появляется, когда прогон исчерпал пул', () => {
    const bank = useQuizStore.getState().questions;
    const future = { next: Date.now() + 86_400_000, stability: 1, difficulty: 0.3 };
    useQuizStore.setState({
      // Весь банк запланирован в будущем: сессия пуста, предлагать нечего.
      scheduledReviews: Object.fromEntries(bank.map((q) => [q.id, future])),
      reviewQuestionIds: [bank[0].id],
      reviewAnswers: [right(bank[0].id)],
      activeTopic: null,
    });

    render(<Results />);

    expect(screen.queryByTestId('review-next-batch')).toBeNull();
  });

  it('exam summary still wins over a stale review stream', () => {
    const [q1, q2] = useQuizStore.getState().questions;
    const startedAt = 1_700_000_000_000;
    useQuizStore.setState({
      // Both a stale review stream and a finished exam are present: the exam
      // branch must take over and read examLastResult.answers.
      reviewQuestionIds: [q1.id, q2.id],
      reviewAnswers: [right(q1.id), right(q2.id)],
      activeTopic: 'file_permissions',
      examLastResult: {
        answers: [right(q1.id), wrong(q2.id), right(q1.id)],
        startedAt,
        finishedAt: startedAt + 90_000,
        durationMs: 60000,
      },
    });

    render(<Results />);

    expect(screen.getByText('Экзамен завершён')).toBeTruthy();
    expect(screen.getByText('2 / 3')).toBeTruthy();
    expect(screen.getByText('67%')).toBeTruthy();
    expect(screen.getByText('Время: 1:30')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Пройти заново' })).toBeTruthy();
  });
});
