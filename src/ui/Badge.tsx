import type { CSSProperties, ReactNode } from 'react';

/**
 * `free | pro | locked | restricted | hint` — четыре роли доступа (Contract) плюс
 * `hint`. `hint` — presentation-роль подсказки «начните с этой» (spec 065, К5.2):
 * она жила тем же каркасом, но с цветом роли успеха; без неё пришлось бы держать
 * в экране копию стилей, ровно от чего уходим.
 *
 * `restricted` (diag-dashboard-fix, handoff §14) — платная тема, к которой у
 * профиля ЕСТЬ доступ (Pro/trial): вместо плашки «БЕСПЛАТНО» синим рисуется
 * тонкий приглушённый замок. Роль отличается от `locked` не цветом, а
 * каркасом: у `restricted` нет ни плашки, ни рамки, ни tap-зоны.
 */
export type BadgeVariant = 'free' | 'pro' | 'locked' | 'restricted' | 'hint';

export interface BadgeProps {
  /** Роль бейджа: «Бесплатно» / «PRO» / «Скоро» / замок платной темы. */
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
  restricted: { color: 'var(--text-secondary)' },
  hint: { color: 'var(--color-success-strong)' },
};

/**
 * Каркас по роли: по умолчанию — плашка из FRAME. `restricted` — «тонкий
 * замок» §14: прозрачный фон, без рамки и отступов, обычная насыщенность.
 * `--text-secondary` на `--bg-surface` (белый) — 8.9:1, на плашке `--bg-elevated`
 * — 6.9:1, то есть приглушённый, но не ниже AA.
 */
const VARIANT_FRAME: Partial<Record<BadgeVariant, CSSProperties>> = {
  restricted: {
    background: 'transparent',
    border: 'none',
    minHeight: 0,
    padding: 0,
    fontWeight: 400,
    fontSize: 'var(--text-sm)',
  },
};

/** Переиспользуемый бейдж. Чистая presentation: ни стора, ни домена, ни переходов. */
export function Badge({ variant, children, testId, style }: BadgeProps) {
  return (
    <span
      data-testid={testId}
      // Роль в DOM: e2e проверяет одним computed-style, что один и тот же
      // variant нигде не покрашен двумя цветами (diag-dashboard-fix).
      data-variant={variant}
      style={{ ...FRAME, ...VARIANT_STYLE[variant], ...VARIANT_FRAME[variant], ...style }}
    >
      {children}
    </span>
  );
}
