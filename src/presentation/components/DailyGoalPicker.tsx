import { useQuizStore } from '@/store/quizStore';
import { SPACING } from '@/presentation/theme';
import { DAILY_GOAL_OPTIONS } from '@/domain/goal';
import { XP_FIRST_ANSWER_OF_DAY, XP_REGULAR_CORRECT } from '@/domain/xp';

/**
 * Подписи трёх пресетов дневной цели. Подсказка считает ВОПРОСЫ (не XP): при
 * таблице начисления +10 даёт первый ответ дня, а верный ответ стоит 3 XP,
 * поэтому «сверх разминки» остаётся goal − 10 XP.
 */
const GOAL_PRESETS: Record<number, { label: string; hint: string }> = {
  10: { label: '10 XP', hint: 'Легко — отметить день' },
  20: { label: '20 XP', hint: 'Обычно — 3–4 вопроса' },
  30: { label: '30 XP', hint: 'Интенсивно — 7 вопросов' },
};

/**
 * Daily goal picker (spec 061, К6).
 *
 * Показывается ровно в одном случае: онбординг уже пройден
 * (`hasCompletedOnboarding`), а цель ещё не подтверждена (`dailyGoalXp === null`).
 * Миграция v5→v6 всегда выставляет 20, поэтому обновившийся пользователь picker
 * не видит — `null` остаётся только у профиля, прошедшего онбординг в этой же
 * сессии. До выбора целью считается дефолт 20 (см. `useDailyGoalProgress`), то
 * есть picker лишь предлагает её сменить.
 *
 * Оверлей, а не элемент потока: Dashboard — длинная страница, и вставленный в
 * поток блок увели бы кнопки потоков ниже фолда (регрессия spec 056).
 */
export function DailyGoalPicker() {
  const hasCompletedOnboarding = useQuizStore((s) => s.hasCompletedOnboarding);
  const dailyGoalXp = useQuizStore((s) => s.dailyGoalXp);
  const setDailyGoal = useQuizStore((s) => s.setDailyGoal);

  if (!hasCompletedOnboarding || dailyGoalXp !== null) return null;

  return (
    <div
      data-testid="daily-goal-picker"
      role="dialog"
      aria-modal="true"
      aria-label="Дневная цель"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 40,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: SPACING.lg,
        background: 'var(--bg-primary)',
      }}
    >
      <div style={{ width: '100%', maxWidth: 360 }}>
        <h2
          style={{
            margin: 0,
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        >
          Сколько XP в день?
        </h2>
        <p
          style={{
            margin: `${SPACING.sm} 0 ${SPACING.lg} 0`,
            fontSize: 14,
            color: 'var(--text-secondary)',
          }}
        >
          {`Первый ответ дня — ${XP_FIRST_ANSWER_OF_DAY} XP, верный ответ — ${XP_REGULAR_CORRECT} XP. Цель можно сменить в любой момент.`}
        </p>

        {DAILY_GOAL_OPTIONS.map((xp) => {
          const preset = GOAL_PRESETS[xp] ?? { label: `${xp} XP`, hint: '' };
          return (
            <button
              key={xp}
              type="button"
              data-testid={`daily-goal-${xp}`}
              onClick={() => setDailyGoal(xp)}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                gap: SPACING.xs,
                width: '100%',
                minHeight: 56,
                padding: SPACING.md,
                marginBottom: SPACING.sm,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-strong)',
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                fontFamily: 'inherit',
                textAlign: 'left',
              }}
            >
              <span style={{ fontSize: 16, fontWeight: 700 }}>{preset.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{preset.hint}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
