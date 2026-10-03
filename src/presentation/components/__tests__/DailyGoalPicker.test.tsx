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
    expect(screen.getByTestId('daily-goal-50')).toBeInTheDocument();
  });

  it('не показывается, если цель уже установлена', () => {
    useQuizStore.setState({ dailyGoalXp: 20 });

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
      screen.getByTestId('daily-goal-50').click();
    });

    expect(useQuizStore.getState().dailyGoalXp).toBe(50);

    rerender(<DailyGoalPicker />);
    expect(screen.queryByTestId('daily-goal-picker')).toBeNull();
  });
});
