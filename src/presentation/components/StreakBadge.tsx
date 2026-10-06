import { useQuizStore } from '@/store/quizStore';
import { useStreakState } from '@/store/dailyGoal';
import { SPACING, LAYOUT } from '@/presentation/theme';
import { messageColor, pluralDays, stateColor, streakMessage, type StreakColor } from '@/domain/goal';

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
 * Тестовый контракт прежний: `role="status"`, `aria-label="Серия N <день|дня|дней>"`
 * (слово согласуется с числом через `pluralDays`, dashboard-ux-2) и число
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
    // «role="status" + aria-label "Серия N дней"» сохранён (слово согласуется
    // с числом: 1 → «день», 2 → «дня», 5 → «дней»).
    <div
      role="status"
      aria-label={`Серия ${streak} ${pluralDays(streak)}`}
      style={{ flexShrink: 0 }}
    >
      <button
        type="button"
        data-testid="streak-badge"
        data-streak-state={state}
        data-streak-color={streakColor}
        aria-label={`Серия ${streak} ${pluralDays(streak)}`}
        onClick={() => navigateTo('analytics')}
        style={{
          width: BADGE_SIZE,
          // min-height, а не height: содержимое (🔥 16px + число 24px + подпись
          // в 3 строки) даёт ~90px, и фиксированная высота 80px обрезала нижнюю
          // строку подписи (scrollHeight 84 vs clientHeight 78 — замерено).
          // 80px остаётся МИНИМУМОМ тап-зоны (spec 067, К3), а не потолком:
          // при коротком сообщении блок выглядит как раньше, при длинном —
          // растёт вместо обрезки. Вариант с обрезкой текста (ellipsis /
          // line-clamp) отклонён: подпись — мотивационное сообщение, а не метка.
          minHeight: BADGE_SIZE,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-1)',
          padding: 'var(--space-1)',
          // Высота считается от рамки: 80px включают padding и border, поэтому
          // контент получает 80 − 2×4 − 2×1 = 70px и не выходит наружу.
          boxSizing: 'border-box',
          flexShrink: 0,
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          border: `1px solid ${color}`,
          borderRadius: LAYOUT.cardRadius,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        <span style={{ fontSize: 'var(--text-base)', lineHeight: 1 }} aria-hidden="true">
          🔥
        </span>
        <span
          style={{ fontSize: 'var(--text-xl)', fontWeight: 700, lineHeight: 1, color }}
        >
          {streak}
        </span>
        <span
          style={{
            fontSize: 10,
            // spec 081: 1.1 ужимало подпись ниже порога TYPO-002 (lh >= 1.4).
            // Бейдж 80px, содержимое центрируется: 14px высоты подписи
            // (10 * 1.4) вместо 11px укладывается в ту же геометрию.
            lineHeight: 1.4,
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
