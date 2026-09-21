import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StreakBadge } from '../StreakBadge';
import { useQuizStore } from '@/store/quizStore';

describe('StreakBadge', () => {
  beforeEach(() => {
    useQuizStore.setState({ streak: 0 });
  });

  it('renders nothing when streak is 0', () => {
    const { container } = render(<StreakBadge />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders the streak count with role="status" and an aria-label', () => {
    useQuizStore.setState({ streak: 5 });

    render(<StreakBadge />);

    expect(screen.getByText('5')).toBeInTheDocument();
    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-label', 'Серия 5 дней');
  });
});