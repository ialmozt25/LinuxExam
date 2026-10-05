import type { CSSProperties, ReactNode } from 'react';

export type CardVariant = 'plain' | 'elevated';

export interface CardProps {
  /** Роль поверхности: обычная (`--bg-surface`) или приподнятая (`--bg-elevated`). */
  variant: CardVariant;
  /** Содержимое карточки. */
  children: ReactNode;
  /**
   * Корневой элемент. `button` — для кликабельной строки темы: e2e-контракты
   * (mobile-layout) требуют `button[data-testid^="topic-"]` и проверяют
   * геометрию прямых потомков.
   */
  as?: 'div' | 'button';
  onClick?: () => void;
  /** data-testid для e2e-контрактов (topic-*, resume-banner). */
  testId?: string;
  /** Доступное имя (для `as="button"`). */
  ariaLabel?: string;
  /** Дополнительные presentation-стили. */
  style?: CSSProperties;
}

/**
 * Каркас карточки: поверхность, рамка, радиус и внутренний отступ — из токенов
 * (`--card-radius`/`--card-padding`/`--space-3`, spec 065).
 */
const BASE: CSSProperties = {
  background: 'var(--bg-surface)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--card-radius)',
  padding: 'var(--card-padding)',
  color: 'inherit',
  fontFamily: 'inherit',
  textAlign: 'left',
  width: '100%',
};

const VARIANT: Record<CardVariant, CSSProperties> = {
  plain: { background: 'var(--bg-surface)' },
  elevated: { background: 'var(--bg-elevated)' },
};

/** Переиспользуемая карточка-поверхность. Без бизнес-логики и без состояния. */
export function Card({
  variant,
  children,
  as = 'div',
  onClick,
  testId,
  ariaLabel,
  style,
}: CardProps) {
  const merged = { ...BASE, ...VARIANT[variant], ...style };

  if (as === 'button') {
    return (
      <button
        type="button"
        data-testid={testId}
        onClick={onClick}
        aria-label={ariaLabel}
        style={{ ...merged, cursor: 'pointer' }}
      >
        {children}
      </button>
    );
  }

  return (
    <div data-testid={testId} style={merged}>
      {children}
    </div>
  );
}
