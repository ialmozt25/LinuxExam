import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import Question from '@/presentation/screens/Question';
import { useQuizStore } from '@/store/quizStore';
import { findPreset } from '@/domain/exam';

// The header back control and the Telegram BackButton are two views of the same
// action. Both must be OFF on the first question of a review/topic run, because
// previousQuestion() is a no-op at index 0.

function resetStore() {
  useQuizStore.setState({
    currentIndex: 0,
    answers: [],
    reviewAnswers: [],
    wrongQuestionIds: [],
    reviewQuestionIds: null,
    isQuizInProgress: false,
    currentScreen: 'dashboard',
    activeTopic: null,
    isPaywallVisible: false,
    isPro: true,
    streak: 0,
    lastActiveDate: null,
    totalXp: 0,
  });
}

const backButton = () => screen.queryByRole('button', { name: 'Назад' });

describe('Question header back control follows currentIndex', () => {
  beforeEach(async () => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
    await useQuizStore.getState().loadQuestions();
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

  it('экзамен идёт на своём экране: Question его не обслуживает', () => {
    // spec 068: инлайн-экзамен в Question.tsx удалён — экзамен (spec 054) живёт
    // на отдельных экранах ExamRun/ExamResults. Прогон не переводит Question ни в
    // какой особый режим: без review-прогона экран показывает регулярный поток со
    // своей обычной навигацией (в отличие от удалённого legacy-режима, который
    // запрещал «назад»).
    const bankIds = useQuizStore.getState().questions.map((q) => q.id);
    useQuizStore.getState().startExamSession(findPreset(30)!, bankIds);
    expect(useQuizStore.getState().currentScreen).toBe('exam-run');
    expect(useQuizStore.getState().reviewQuestionIds).toBeNull();

    render(<Question />);
    expect(backButton()).toBeNull();

    act(() => useQuizStore.setState({ currentIndex: 1 }));
    expect(backButton()).not.toBeNull();
  });
});
