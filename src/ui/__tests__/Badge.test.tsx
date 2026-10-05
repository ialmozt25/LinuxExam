import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/ui/Badge';

describe('Badge', () => {
  it('рендерится с текстом и testid', () => {
    render(
      <Badge variant="free" testId="paywall-badge-free">
        Бесплатно
      </Badge>,
    );

    const badge = screen.getByTestId('paywall-badge-free');
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveTextContent('Бесплатно');
    expect(badge.tagName).toBe('SPAN');
  });

  it('variant задаёт роль цвета из токенов', () => {
    render(
      <Badge variant="pro" testId="pro">
        PRO
      </Badge>,
    );
    render(
      <Badge variant="locked" testId="locked">
        Скоро
      </Badge>,
    );

    expect(screen.getByTestId('pro').style.color).toBe('var(--color-accent-strong)');
    expect(screen.getByTestId('locked').style.color).toBe('var(--color-accent-strong)');
  });

  it('тап-зона не меньше 32px и текст не переносится', () => {
    render(<Badge variant="free">Бесплатно</Badge>);

    const badge = screen.getByText('Бесплатно');
    expect(badge.style.minHeight).toBe('32px');
    expect(badge.style.whiteSpace).toBe('nowrap');
    expect(badge.style.display).toBe('inline-flex');
  });
});
