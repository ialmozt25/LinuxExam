import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from '@/ui/Button';

describe('Button', () => {
  it('рендерится с текстом, testid и типом button', () => {
    render(
      <Button variant="primary" testId="dashboard-continue">
        Продолжить
      </Button>,
    );

    const button = screen.getByTestId('dashboard-continue');
    expect(button).toHaveTextContent('Продолжить');
    expect(button).toHaveAttribute('type', 'button');
  });

  it('variant задаёт роль цвета: primary — токены роли, secondary — прозрачный фон', () => {
    render(
      <Button variant="primary" testId="primary">
        Главный
      </Button>,
    );
    render(
      <Button variant="secondary" testId="secondary">
        Второй
      </Button>,
    );

    const primary = screen.getByTestId('primary');
    expect(primary.style.background).toBe('var(--btn-primary-bg)');
    expect(primary.style.color).toBe('var(--btn-primary-text)');
    expect(primary.style.borderRadius).toBe('var(--btn-primary-radius)');

    const secondary = screen.getByTestId('secondary');
    expect(secondary.style.background).toBe('var(--btn-secondary-bg)');
    expect(secondary.style.borderRadius).toBe('var(--btn-secondary-radius)');
    expect(secondary.style.color).toBe('var(--text-primary)');
  });

  it('иконочная (ghost) кнопка несёт aria-label и тап-зону 44px', () => {
    render(
      <Button variant="ghost" testId="theme-toggle" ariaLabel="Переключить на тёмную">
        <span aria-hidden="true">☾</span>
      </Button>,
    );

    const button = screen.getByTestId('theme-toggle');
    expect(button).toHaveAccessibleName('Переключить на тёмную');
    expect(button.style.minHeight).toBe('44px');
    expect(button.style.minWidth).toBe('44px');
  });

  it('клик вызывает onClick', async () => {
    const onClick = vi.fn();
    render(
      <Button variant="secondary" onClick={onClick} testId="exam-mode">
        Exam mode
      </Button>,
    );

    await userEvent.click(screen.getByTestId('exam-mode'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
