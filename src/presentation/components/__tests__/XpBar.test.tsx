import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { XpBar } from '../XpBar';
import { useQuizStore } from '@/store/quizStore';

describe('XpBar — дневная цель (spec 061)', () => {
  beforeEach(() => {
    useQuizStore.setState({ todayXp: 0, dailyGoalXp: 20 });
  });

  it('рендерит текст «0 / 20 XP» и дневную полосу с доступным именем', () => {
    render(<XpBar />);

    expect(screen.getByTestId('xp-bar')).toBeInTheDocument();
    expect(screen.getByTestId('xp-bar-daily-label')).toHaveTextContent('0 / 20 XP');
    expect(screen.getByRole('img', { name: 'Дневная цель: 0 из 20 XP' })).toBeInTheDocument();
  });

  it('15 / 20 → 75 %, акцентный цвет, засечка 85 % неактивна', () => {
    useQuizStore.setState({ todayXp: 15 });

    render(<XpBar />);

    expect(screen.getByTestId('xp-bar-fill')).toHaveStyle({ width: '75%' });
    expect(screen.getByTestId('xp-bar')).toHaveAttribute('data-xp-color', 'accent');
    expect(screen.getByTestId('xp-bar')).toHaveAttribute('data-mark-active', 'false');
    expect(screen.getByTestId('xp-bar-daily-label')).toHaveTextContent('15 / 20 XP');
  });

  it('18 / 20 → 90 %, засечка 85 % активна, цвет зелёный', () => {
    useQuizStore.setState({ todayXp: 18 });

    render(<XpBar />);

    expect(screen.getByTestId('xp-bar-fill')).toHaveStyle({ width: '90%' });
    expect(screen.getByTestId('xp-bar')).toHaveAttribute('data-mark-active', 'true');
    expect(screen.getByTestId('xp-bar')).toHaveAttribute('data-xp-color', 'green');
    expect(screen.getByTestId('xp-bar-mark')).toBeInTheDocument();
  });

  it('<50 % → серый цвет заполнения', () => {
    useQuizStore.setState({ todayXp: 5 });

    render(<XpBar />);

    expect(screen.getByTestId('xp-bar')).toHaveAttribute('data-xp-color', 'gray');
    expect(screen.getByTestId('xp-bar-fill')).toHaveStyle({ width: '25%' });
  });

  it('цель достигнута (25 / 20) → 100 %, зелёный', () => {
    useQuizStore.setState({ todayXp: 25 });

    render(<XpBar />);

    expect(screen.getByTestId('xp-bar-fill')).toHaveStyle({ width: '100%' });
    expect(screen.getByTestId('xp-bar')).toHaveAttribute('data-xp-color', 'green');
    expect(screen.getByTestId('xp-bar-daily-label')).toHaveTextContent('25 / 20 XP');
  });

  it('null-цель (picker не пройден) показывает дефолт 30 XP, без NaN', () => {
    useQuizStore.setState({ todayXp: 15, dailyGoalXp: null });

    render(<XpBar />);

    expect(screen.getByTestId('xp-bar-daily-label')).toHaveTextContent('15 / 30 XP');
    expect(screen.getByTestId('xp-bar-fill')).toHaveStyle({ width: '50%' });
    expect(screen.getByTestId('xp-bar')).toHaveAttribute('data-xp-color', 'accent');
  });

  it('уровень не дублируется: в баре нет второй подписи «Уровень N»', () => {
    useQuizStore.setState({ totalXp: 150, todayXp: 10 });

    render(<XpBar />);

    expect(screen.queryByText(/Уровень/)).toBeNull();
  });
});
