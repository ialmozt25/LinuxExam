import { useQuizStore } from '@/store/quizStore';
import { ScreenContainer } from '@/presentation/components/ScreenContainer';
import { SPACING, LAYOUT } from '@/presentation/theme';
import { ONBOARDING_GOALS } from '@/domain/onboarding';

/**
 * Онбординг (spec 060), шаг 1 из 3 — цель.
 *
 * Пользователь отвечает на «зачем я здесь» до любых обязательств: клик по карточке
 * фиксирует цель в сторе и открывает демо-квиз. Обязательного шага «пропустить» нет —
 * цель ничего не блокирует, поэтому отказ от выбора не нужен.
 */
export default function OnboardingGoal() {
  const setOnboardingGoal = useQuizStore((s) => s.setOnboardingGoal);
  const navigateTo = useQuizStore((s) => s.navigateTo);

  const handlePick = (goalId: string) => {
    setOnboardingGoal(goalId);
    navigateTo('onboarding-demo');
  };

  return (
    <ScreenContainer data-testid="onboarding-goal">
      <h1
        style={{
          fontSize: 24,
          fontWeight: 700,
          letterSpacing: '-0.5px',
          margin: 0,
          color: 'var(--text-primary)',
        }}
      >
        Зачем вам LinuxExam?
      </h1>
      <p
        style={{
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          marginTop: SPACING.xs,
          marginBottom: 0,
          lineHeight: 1.5,
        }}
      >
        Выберите цель — подберём три вопроса для разминки.
      </p>

      <div
        role="radiogroup"
        aria-label="Цель подготовки"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.sm,
          marginTop: SPACING.lg,
        }}
      >
        {ONBOARDING_GOALS.map((goal) => (
          <button
            key={goal.id}
            type="button"
            role="radio"
            aria-checked={false}
            data-testid={`onboarding-goal-${goal.id}`}
            onClick={() => handlePick(goal.id)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: SPACING.xs,
              width: '100%',
              minHeight: 44,
              padding: SPACING.md,
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: LAYOUT.cardRadius,
              color: 'var(--text-primary)',
              fontFamily: 'inherit',
              textAlign: 'left',
              cursor: 'pointer',
            }}
          >
            <span style={{ fontSize: 16, fontWeight: 600 }}>{goal.label}</span>
            <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}>
              {goal.description}
            </span>
          </button>
        ))}
      </div>
    </ScreenContainer>
  );
}
