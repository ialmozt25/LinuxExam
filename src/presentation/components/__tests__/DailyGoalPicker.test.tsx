import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { DailyGoalPicker } from '../DailyGoalPicker';
import { useQuizStore } from '@/store/quizStore';

describe('DailyGoalPicker (spec 061, К6)', () => {
  beforeEach(() => {
    useQuizStore.setState({ hasCompletedOnboarding: true, dailyGoalXp: null });
  });

  it('показывается при hasCompletedOnboarding && dailyGoalXp === null', () => {
    render(<DailyGoalPicker />);

    expect(screen.getByTestId('daily-goal-picker')).toBeInTheDocument();
    expect(screen.getByTestId('daily-goal-10')).toBeInTheDocument();
    expect(screen.getByTestId('daily-goal-20')).toBeInTheDocument();
    expect(screen.getByTestId('daily-goal-30')).toBeInTheDocument();
    // Прежний верхний пресет 50 XP из XP-механики убран: при новой таблице
    // начисления он требовал бы ~13 верных ответов подряд.
    expect(screen.queryByTestId('daily-goal-50')).toBeNull();
  });

  it('подсказка считает XP по таблице начисления, а не «один вопрос = 10 XP»', () => {
    render(<DailyGoalPicker />);

    expect(screen.getByText(/Первый ответ дня — 10 XP, верный ответ — 3 XP/)).toBeInTheDocument();
  });

  it('не показывается, если цель уже установлена', () => {
    useQuizStore.setState({ dailyGoalXp: 30 });

    render(<DailyGoalPicker />);

    expect(screen.queryByTestId('daily-goal-picker')).toBeNull();
  });

  it('не показывается до онбординга', () => {
    useQuizStore.setState({ hasCompletedOnboarding: false, dailyGoalXp: null });

    render(<DailyGoalPicker />);

    expect(screen.queryByTestId('daily-goal-picker')).toBeNull();
  });

  it('выбор карточки пишет цель в стор и скрывает picker', () => {
    const { rerender } = render(<DailyGoalPicker />);

    act(() => {
      screen.getByTestId('daily-goal-30').click();
    });

    expect(useQuizStore.getState().dailyGoalXp).toBe(30);

    rerender(<DailyGoalPicker />);
    expect(screen.queryByTestId('daily-goal-picker')).toBeNull();
  });
});
