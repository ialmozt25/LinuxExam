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
  });
}

const right = (questionId: string) => ({ questionId, selectedIndex: 0, isCorrect: true });
const wrong = (questionId: string) => ({ questionId, selectedIndex: 1, isCorrect: false });

describe('Results reads the active stream', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    useQuizStore.getState().loadQuestions();
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
    // 12 questions were graded (one correct), not 0/12 while the card says 1/2.
    expect(screen.getByText('1/12')).toBeTruthy();
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