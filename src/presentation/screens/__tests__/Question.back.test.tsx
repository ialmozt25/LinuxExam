import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import Question from '@/presentation/screens/Question';
import { useQuizStore } from '@/store/quizStore';

// The header back control and the Telegram BackButton are two views of the same
// action. Both must be OFF on the first question of a review/topic run, because
// previousQuestion() is a no-op at index 0.

function resetStore() {
  useQuizStore.setState({
    currentIndex: 0,
    answers: [],
    reviewAnswers: [],
    examAnswers: [],
    wrongQuestionIds: [],
    reviewQuestionIds: null,
    isQuizInProgress: false,
    currentScreen: 'dashboard',
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

const backButton = () => screen.queryByRole('button', { name: 'Назад' });

describe('Question header back control follows currentIndex', () => {
  beforeEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    useQuizStore.getState().loadQuestions();
    resetStore();
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('review: hidden on the first question, shown on the second', () => {
    const questions = useQuizStore.getState().questions;
    useQuizStore.getState().startReviewQuiz([questions[0].id, questions[1].id]);
    expect(useQuizStore.getState().currentIndex).toBe(0);

    render(<Question />);
    expect(backButton()).toBeNull();

    act(() => useQuizStore.setState({ currentIndex: 1 }));
    expect(backButton()).not.toBeNull();
  });

  it('topic quiz: hidden on the first question', () => {
    useQuizStore.getState().startTopicQuiz('file_permissions');
    expect(useQuizStore.getState().currentIndex).toBe(0);

    render(<Question />);
    expect(backButton()).toBeNull();
  });

  it('regular: hidden on the first question, shown on the second', () => {
    useQuizStore.getState().startRegularQuiz();
    render(<Question />);
    expect(backButton()).toBeNull();

    act(() => useQuizStore.setState({ currentIndex: 1 }));
    expect(backButton()).not.toBeNull();
  });

  it('exam: never offers a back control', () => {
    useQuizStore.getState().startExam(5, 60000);
    render(<Question />);
    expect(backButton()).toBeNull();

    act(() => useQuizStore.setState({ currentIndex: 1 }));
    expect(backButton()).toBeNull();
  });
});