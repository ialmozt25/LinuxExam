import { useQuizStore } from '@/store/quizStore';
import { useDemoAnswers } from '@/store/onboarding';
import { ScreenContainer } from '@/presentation/components/ScreenContainer';
import { SPACING, LAYOUT } from '@/presentation/theme';
import { computeDemoResult, ONBOARDING_GOALS } from '@/domain/onboarding';

/**
 * Онбординг (spec 060), шаг 3 из 3 — результат.
 *
 * Показывает счёт демо-квиза и персональное сообщение, затем уводит на Dashboard.
 * Ответы приходят из session-only канала демо-квиза: в `questionStats` они не
 * пишутся, поэтому должны быть переданы явно.
 *
 * Если демо не запускалось (пустой банк) — канал пуст, и итог считается по пустому
 * массиву: `computeDemoResult` отдаёт fallback-сообщение вместо NaN.
 */
export default function OnboardingResult() {
  const completeOnboarding = useQuizStore((s) => s.completeOnboarding);
  const navigateTo = useQuizStore((s) => s.navigateTo);
  const goalId = useQuizStore((s) => s.onboardingGoal);
  const answers = useDemoAnswers();

  const result = computeDemoResult(answers);
  const goalLabel = ONBOARDING_GOALS.find((g) => g.id === goalId)?.label ?? null;

  const handleStart = () => {
    completeOnboarding();
    navigateTo('dashboard');
  };

  return (
    <ScreenContainer data-testid="onboarding-result">
      <h1
        style={{
          fontSize: 'var(--heading-1)',
          fontWeight: 700,
          letterSpacing: '-0.5px',
          margin: 0,
          color: 'var(--text-primary)',
        }}
      >
        Готово
      </h1>

      {goalLabel !== null && (
        <p
          data-testid="onboarding-result-goal"
          style={{
            margin: `${SPACING.xs} 0 0 0`,
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
          }}
        >
          {`Цель: ${goalLabel}`}
        </p>
      )}

      <p
        data-testid="onboarding-result-score"
        style={{
          margin: `${SPACING.lg} 0 0 0`,
          padding: SPACING.md,
          background: 'var(--bg-surface)',
          borderRadius: LAYOUT.cardRadius,
          fontSize: 'var(--heading-2)',
          fontWeight: 700,
          textAlign: 'center',
          color: 'var(--text-primary)',
        }}
      >
        {`${result.correct} из ${result.total}`}
      </p>

      <p
        data-testid="onboarding-result-message"
        style={{
          margin: `${SPACING.md} 0 0 0`,
          fontSize: 'var(--body)',
          lineHeight: 'var(--body-line-height)',
          color: 'var(--text-secondary)',
        }}
      >
        {result.message}
      </p>

      <button
        type="button"
        data-testid="onboarding-start"
        onClick={handleStart}
        style={{
          width: '100%',
          marginTop: SPACING.xl,
          padding: SPACING.md,
          background: 'var(--accent)',
          color: 'var(--btn-primary-text)',
          border: 'none',
          borderRadius: 'var(--btn-primary-radius)',
          fontSize: 'var(--body)',
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        Начать
      </button>
    </ScreenContainer>
  );
}
