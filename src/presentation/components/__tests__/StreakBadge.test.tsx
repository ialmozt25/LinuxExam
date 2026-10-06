import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import { StreakBadge } from '../StreakBadge';
import { useQuizStore } from '@/store/quizStore';
import { shiftIsoDate } from '@/domain/goal';

const today = new Date().toISOString().slice(0, 10);

describe('StreakBadge (spec 061)', () => {
  beforeEach(() => {
    useQuizStore.setState({
      streak: 0,
      totalXp: 0,
      todayXp: 0,
      lastActiveDate: null,
      dailyGoalXp: 20,
    });
  });

  it('streak 0 рендерится (UI серии больше не скрыт)', () => {
    render(<StreakBadge />);

    expect(screen.getByTestId('streak-badge')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    // ux-copy-3 (2026-10-07): под числом — только слово серии (`pluralDays`),
    // без мотивационной подписи `streakMessage`: 0 → «дней».
    expect(screen.getByText('дней подряд')).toBeInTheDocument();
  });

  it('рендерит число серии с role="status" и aria-label', () => {
    useQuizStore.setState({ streak: 5, todayXp: 10, lastActiveDate: today });

    render(<StreakBadge />);

    expect(screen.getByText('5')).toBeInTheDocument();
    // Число больше не дублируется подписью (ux-copy-3): под ним только слово.
    expect(screen.getByText('дней подряд')).toBeInTheDocument();
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-label', 'Серия 5 дней');
    // Доступное имя кнопки дублирует статус — тап тоже обязан читаться скринридером.
    expect(screen.getByRole('button', { name: 'Серия 5 дней' })).toBeInTheDocument();
  });

  it('active (todayXp > 0) → зелёное состояние', () => {
    useQuizStore.setState({ streak: 3, todayXp: 10, lastActiveDate: today });

    render(<StreakBadge />);

    expect(screen.getByTestId('streak-badge')).toHaveAttribute('data-streak-state', 'active');
  });

  it('warning (todayXp = 0, вчерашняя активность) → оранжевое состояние', () => {
    useQuizStore.setState({ streak: 3, todayXp: 0, lastActiveDate: shiftIsoDate(today, -1) });

    render(<StreakBadge />);

    expect(screen.getByTestId('streak-badge')).toHaveAttribute('data-streak-state', 'warning');
  });

  it('broken (активность раньше вчера) → красное состояние', () => {
    useQuizStore.setState({ streak: 3, todayXp: 0, lastActiveDate: shiftIsoDate(today, -3) });

    render(<StreakBadge />);

    expect(screen.getByTestId('streak-badge')).toHaveAttribute('data-streak-state', 'broken');
  });

  it('тап по бейджу ведёт на аналитику', () => {
    useQuizStore.setState({ streak: 3, todayXp: 10, lastActiveDate: today });

    render(<StreakBadge />);
    act(() => {
      screen.getByTestId('streak-badge').click();
    });

    expect(useQuizStore.getState().currentScreen).toBe('analytics');
  });
});
