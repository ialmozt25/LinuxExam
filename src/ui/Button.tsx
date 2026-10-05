import type { CSSProperties, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';

export interface ButtonProps {
  /** Роль кнопки: заливка / обводка / невидимая (иконочная). */
  variant: ButtonVariant;
  /** Текст или разметка внутри кнопки. */
  children: ReactNode;
  onClick?: () => void;
  /** data-testid для e2e-контрактов (dashboard-continue, exam-mode, theme-toggle...). */
  testId?: string;
  /**
   * Доступное имя. Обязательно для иконочных кнопок (в `ghost` есть только
   * иконка): Contract, AGENTS.md.
   */
  ariaLabel?: string;
  /** Дополнительные presentation-стили (отступы, ширина, размер шрифта). */
  style?: CSSProperties;
}

/**
 * База для текстовых кнопок: ширина, отступы и радиус — из токенов, шрифт
 * наследуется (кнопки в приложении не используют системный шрифт браузера).
 */
const BASE: CSSProperties = {
  width: '100%',
  padding: 'var(--space-3)',
  marginTop: 'var(--space-4)',
  border: 'none',
  borderRadius: 'var(--radius-md)',
  fontSize: 'var(--text-sm)',
  fontWeight: 600,
  cursor: 'pointer',
  fontFamily: 'inherit',
  textAlign: 'left',
};

/**
 * Роли (spec 065/079). `primary` — акцентная заливка и ОБЯЗАТЕЛЬНО белый текст
 * роли `--btn-primary-text`: `--text-primary` в светлой теме тёмный и давал
 * 2.88:1. `secondary` — прозрачный фон с акцентной обводкой. `ghost` — только
 * иконка и цвет текста, без рамки и отступов.
 */
const VARIANT: Record<ButtonVariant, CSSProperties> = {
  primary: {
    background: 'var(--btn-primary-bg)',
    color: 'var(--btn-primary-text)',
    borderRadius: 'var(--btn-primary-radius)',
  },
  secondary: {
    background: 'var(--btn-secondary-bg)',
    color: 'var(--text-primary)',
    border: '1px solid var(--accent)',
    borderRadius: 'var(--btn-secondary-radius)',
  },
  ghost: {
    background: 'transparent',
    color: 'var(--btn-ghost-text)',
    width: 'auto',
    padding: 0,
    marginTop: 0,
    minWidth: 44,
    minHeight: 44,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
};

/** Переиспользуемая кнопка. Чистая presentation: onClick — единственный вход наружу. */
export function Button({ variant, children, onClick, testId, ariaLabel, style }: ButtonProps) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      aria-label={ariaLabel}
      style={{ ...BASE, ...VARIANT[variant], ...style }}
    >
      {children}
    </button>
  );
}
