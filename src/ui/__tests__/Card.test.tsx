import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Card } from '@/ui/Card';

describe('Card', () => {
  it('рендерится как div с поверхностью plain по умолчанию', () => {
    render(
      <Card variant="plain" testId="resume-banner">
        Тест не завершён
      </Card>,
    );

    const card = screen.getByTestId('resume-banner');
    expect(card.tagName).toBe('DIV');
    expect(card).toHaveTextContent('Тест не завершён');
    expect(card.style.background).toBe('var(--bg-surface)');
    expect(card.style.borderRadius).toBe('var(--card-radius)');
  });

  it('variant elevated даёт приподнятую поверхность', () => {
    render(
      <Card variant="elevated" testId="elevated">
        Бейдж
      </Card>,
    );

    expect(screen.getByTestId('elevated').style.background).toBe('var(--bg-elevated)');
  });

  it('as="button" рендерит кликабельную строку с доступным именем и кликом', async () => {
    const onClick = vi.fn();
    render(
      <Card
        variant="plain"
        as="button"
        testId="topic-essential_tools"
        ariaLabel="Начать тему: Essential tools"
        onClick={onClick}
      >
        <span>Essential tools</span>
      </Card>,
    );

    const row = screen.getByTestId('topic-essential_tools');
    expect(row.tagName).toBe('BUTTON');
    expect(row).toHaveAttribute('type', 'button');
    expect(row).toHaveAccessibleName('Начать тему: Essential tools');
    expect(row.style.cursor).toBe('pointer');

    await userEvent.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
