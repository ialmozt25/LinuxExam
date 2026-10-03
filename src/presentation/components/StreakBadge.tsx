import { useQuizStore } from '@/store/quizStore';
import { useStreakState } from '@/store/dailyGoal';
import { SPACING, LAYOUT } from '@/presentation/theme';
import { messageColor, stateColor, streakMessage, type StreakColor } from '@/domain/goal';

/** Размер бейджа серии (spec 061, К3): квадрат ≈80×80. */
const BADGE_SIZE = 80;

const COLOR_VAR: Record<StreakColor, string> = {
  green: 'var(--success)',
  orange: 'var(--warning)',
  red: 'var(--danger)',
};

/**
 * Streak badge (spec 061). Существующий компонент (31 строка) расширен до
 * retention-вида: эмодзи 🔥 + крупное число дней + сообщение серии.
 *
 * Состояние считается по сегодняшней активности, а не по одной длине серии:
 * active (сегодня занимались) → green, warning (последняя активность вчера) →
 * orange, broken (раньше) → red. `messageColor` остаётся домен-классификацией
 * длины серии.
 *
 * Тестовый контракт прежний: `role="status"`, `aria-label="Серия N дней"` и число
 * отдельным текстовым узлом.
 */
export function StreakBadge() {
  const streak = useQuizStore((s) => s.streak);
  const todayXp = useQuizStore((s) => s.todayXp);
  const navigateTo = useQuizStore((s) => s.navigateTo);
  const state = useStreakState();

  const color = COLOR_VAR[stateColor(state)];
  const caption = streakMessage(streak);
  // Домен вызывается для полноты контракта (классификация длины серии), но
  // показываемый цвет берётся из сегодняшнего состояния.
  const streakColor = messageColor(streak);

  return (
    // `role="status"` живёт на обёртке, а не на кнопке: axe запрещает
    // `role="status"` на `<button>` (aria-allowed-role), а тестовый контракт
    // «role="status" + aria-label "Серия N дней"» сохранён.
    <div
      role="status"
      aria-label={`Серия ${streak} дней`}
      style={{ flexShrink: 0 }}
    >
      <button
        type="button"
        data-testid="streak-badge"
        data-streak-state={state}
        data-streak-color={streakColor}
        aria-label={`Серия ${streak} дней`}
        onClick={() => navigateTo('analytics')}
        style={{
          width: BADGE_SIZE,
          height: BADGE_SIZE,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: SPACING.xs,
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          border: `1px solid ${color}`,
          borderRadius: LAYOUT.cardRadius,
          cursor: 'pointer',
          fontFamily: 'inherit',
          padding: SPACING.xs,
        }}
      >
        <span style={{ fontSize: 16, lineHeight: 1 }} aria-hidden="true">
          🔥
        </span>
        <span style={{ fontSize: 24, fontWeight: 700, lineHeight: 1, color }}>{streak}</span>
        <span
          style={{
            fontSize: 10,
            lineHeight: 1.1,
            textAlign: 'center',
            color: 'var(--text-secondary)',
          }}
        >
          {caption}
        </span>
      </button>
    </div>
  );
}
