import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import OnboardingDemo from '@/presentation/screens/OnboardingDemo';
import { useQuizStore } from '@/store/quizStore';
import { demoAnswerFeedback, DEMO_FEEDBACK_CORRECT, DEMO_FEEDBACK_WRONG } from '@/domain/onboarding';
import { DEFAULT_DAILY_GOAL_XP } from '@/domain/goal';

/**
 * Онбординг (spec 060, упрощён): ЕДИНСТВЕННЫЙ его экран — демо-квиз.
 *
 * Контракт экрана: инлайн-фидбек после КАЖДОГО ответа, финальная кнопка
 * «Начать обучение →» вместо прежнего экрана «Готово · N из 3», и ни одного
 * ответа в статистике пользователя — иначе первый же ответ в онбординге выключил
 * бы Fresh User Mode на Dashboard.
 */

async function resetStore() {
  if (typeof localStorage !== 'undefined') localStorage.clear();
  await useQuizStore.getState().loadQuestions();
  useQuizStore.setState({
    answers: [],
    reviewAnswers: [],
    reviewQuestionIds: null,
    reviewKind: null,
    isQuizInProgress: false,
    currentIndex: 0,
    currentScreen: 'onboarding-demo',
    activeTopic: null,
    wrongQuestionIds: [],
    questionStats: {},
    scheduledReviews: {},
    streak: 0,
    totalXp: 0,
    isPro: true,
    onboardingGoal: null,
    hasCompletedOnboarding: false,
    dailyGoalXp: null,
  });
}

describe('OnboardingDemo — inline celebration и финальная кнопка', () => {
  beforeEach(async () => {
    await resetStore();
  });

  afterEach(() => {
    if (typeof localStorage !== 'undefined') localStorage.clear();
  });

  it('до ответа фидбека нет, кнопка не последняя', () => {
    render(<OnboardingDemo />);

    expect(screen.getByTestId('onboarding-demo-progress').textContent).toBe('Вопрос 1 из 3');
    expect(screen.queryByTestId('onboarding-feedback')).toBeNull();
    expect(screen.getByTestId('onboarding-demo-next').textContent).toBe('Дальше');
  });

  it('после ответа показывает inline celebration с вердиктом и текстом', async () => {
    const user = userEvent.setup();
    render(<OnboardingDemo />);

    const bank = useQuizStore.getState().questions;
    await user.click(screen.getByTestId('onboarding-option-0'));

    const feedback = screen.getByTestId('onboarding-feedback');
    const correct = feedback.getAttribute('data-correct') === 'true';
    expect(feedback.getAttribute('data-correct')).toMatch(/^(true|false)$/);
    expect(screen.getByTestId('onboarding-feedback-text').textContent).toBe(
      demoAnswerFeedback(correct),
    );
    expect([DEMO_FEEDBACK_CORRECT, DEMO_FEEDBACK_WRONG]).toContain(
      screen.getByTestId('onboarding-feedback-text').textContent,
    );
    // Экран-итог удалён: счёт «N из 3» нигде не рендерится.
    expect(screen.queryByTestId('onboarding-result')).toBeNull();
    expect(bank.length).toBeGreaterThan(0);
  });

  it('ответ фиксируется первым кликом: сменить его нельзя', async () => {
    const user = userEvent.setup();
    render(<OnboardingDemo />);

    const first = screen.getByTestId('onboarding-option-0');
    const other = screen.getByTestId('onboarding-option-1');

    await user.click(first);
    const verdict = screen.getByTestId('onboarding-feedback').getAttribute('data-correct');

    await user.click(other);

    expect(screen.getByTestId('onboarding-feedback').getAttribute('data-correct')).toBe(verdict);
    expect(first.hasAttribute('disabled')).toBe(true);
  });

  it('три шага: «Дальше» ×2, затем «Начать обучение →» завершает онбординг', async () => {
    const user = userEvent.setup();
    render(<OnboardingDemo />);

    for (let step = 1; step <= 3; step++) {
      expect(screen.getByTestId('onboarding-demo-progress').textContent).toBe(
        `Вопрос ${step} из 3`,
      );
      await user.click(screen.getByTestId('onboarding-option-0'));

      const next = screen.getByTestId('onboarding-demo-next');
      if (step < 3) {
        expect(next.textContent).toBe('Дальше');
      } else {
        expect(next.textContent).toBe('Начать обучение →');
      }
      await user.click(next);
    }

    const state = useQuizStore.getState();
    expect(state.hasCompletedOnboarding).toBe(true);
    // Пикер дневной цели больше не часть потока: цель фиксируется дефолтом.
    expect(state.dailyGoalXp).toBe(DEFAULT_DAILY_GOAL_XP);
    expect(state.currentScreen).toBe('dashboard');
  });

  it('демо не попадает в статистику: fresh mode на Dashboard переживает онбординг', async () => {
    const user = userEvent.setup();
    render(<OnboardingDemo />);

    for (let step = 0; step < 3; step++) {
      await user.click(screen.getByTestId('onboarding-option-0'));
      await user.click(screen.getByTestId('onboarding-demo-next'));
    }

    const state = useQuizStore.getState();
    expect(Object.keys(state.questionStats)).toHaveLength(0);
    expect(state.answers).toHaveLength(0);
    expect(state.reviewAnswers).toHaveLength(0);
    expect(state.totalXp).toBe(0);
  });
});
