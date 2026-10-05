import type { CSSProperties, ReactNode } from 'react';

/**
 * `free | pro | locked` — три роли доступа (Contract). `hint` — четвёртая
 * presentation-роль: подсказка «начните с этой» (spec 065, К5.2) жила тем же
 * каркасом, но с цветом роли успеха; без неё пришлось бы держать в экране
 * копию стилей, ровно от чего уходим.
 */
export type BadgeVariant = 'free' | 'pro' | 'locked' | 'hint';

export interface BadgeProps {
  /** Роль бейджа: «Бесплатно» / «PRO» / «Скоро». */
  variant: BadgeVariant;
  /** Содержимое бейджа (обычно одно слово или короткая подсказка). */
  children: ReactNode;
  /** data-testid для e2e-контрактов (paywall-badge-free/pro, topic-first-cta). */
  testId?: string;
  /** Дополнительные presentation-стили (например textTransform для PRO). */
  style?: CSSProperties;
}

/**
 * Каркас бейджа темы. Значения перенесены 1:1 из Dashboard.tsx (spec 067, К3):
 * `minHeight: 32` — тап-зона не меньше 32px (проверяется e2e mobile-layout),
 * `maxWidth: 100%` + обрезка — бейдж не выдавливает название темы на 390px.
 */
const FRAME: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  minHeight: 32,
  fontSize: 'var(--text-xs)',
  fontWeight: 600,
  background: 'var(--bg-elevated)',
  border: '1px solid var(--border-subtle)',
  padding: '4px 8px',
  borderRadius: 'var(--radius-sm)',
  letterSpacing: '0.3px',
  flexShrink: 0,
  maxWidth: '100%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

/**
 * Цвет — только токены (spec 079): на светлой плашке бейджа `--accent` давал
 * 2.59:1, `--success` — 4.15:1; тёмные роли дают 4.78:1 и 5.35:1.
 */
const VARIANT_STYLE: Record<BadgeVariant, CSSProperties> = {
  free: { color: 'var(--text-secondary)' },
  pro: { color: 'var(--color-accent-strong)' },
  locked: { color: 'var(--color-accent-strong)' },
  hint: { color: 'var(--color-success-strong)' },
};

/** Переиспользуемый бейдж. Чистая presentation: ни стора, ни домена, ни переходов. */
export function Badge({ variant, children, testId, style }: BadgeProps) {
  return (
    <span data-testid={testId} style={{ ...FRAME, ...VARIANT_STYLE[variant], ...style }}>
      {children}
    </span>
  );
}
