import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { XpBar } from '../XpBar';
import { useQuizStore } from '@/store/quizStore';

describe('XpBar', () => {
  beforeEach(() => {
    useQuizStore.setState({ totalXp: 0 });
  });

  it('xp = 0 → level 1, aria-valuenow 0', () => {
    useQuizStore.setState({ totalXp: 0 });

    render(<XpBar />);

    expect(screen.getByText('Уровень 1')).toBeInTheDocument();
    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '0');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(bar).toHaveAttribute('aria-label', 'Опыт');
  });

  it('xp = 50 → level 1, aria-valuenow 50', () => {
    useQuizStore.setState({ totalXp: 50 });

    render(<XpBar />);

    expect(screen.getByText('Уровень 1')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
  });

  it('xp = 150 → level 2, aria-valuenow 50', () => {
    useQuizStore.setState({ totalXp: 150 });

    render(<XpBar />);

    expect(screen.getByText('Уровень 2')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '50');
    expect(screen.getByText('150 XP')).toBeInTheDocument();
  });
});