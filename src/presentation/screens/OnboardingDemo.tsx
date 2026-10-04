import { useEffect, useMemo, useState } from 'react';
import { useQuizStore } from '@/store/quizStore';
import { setDemoAnswers } from '@/store/onboarding';
import { ScreenContainer } from '@/presentation/components/ScreenContainer';
import { SPACING, LAYOUT } from '@/presentation/theme';
import { pickDemoQuestions } from '@/domain/onboarding';

/**
 * Онбординг (spec 060), шаг 2 из 3 — демо-квиз.
 *
 * Три вопроса подряд, по одному на экран, БЕЗ фидбека между ними: смысл шага —
 * дать попробовать формат, а не учить. Ответы живут только в локальном состоянии
 * компонента и передаются на экран итога через session-only канал
 * (`setDemoAnswers`), а НЕ через `questionStats` и не через поток `answers`:
 * демо не должно попадать ни в статистику, ни в прогресс настоящего пользователя.
 *
 * Пустой банк (чанки ещё не пришли) сразу отправляет на итог — там уже есть
 * fallback-сообщение, поэтому экран не остаётся пустым.
 */
export default function OnboardingDemo() {
  const goalId = useQuizStore((s) => s.onboardingGoal);
  const bank = useQuizStore((s) => s.questions);
  const navigateTo = useQuizStore((s) => s.navigateTo);

  const [index, setIndex] = useState<number>(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [answers, setAnswers] = useState<{ isCorrect: boolean }[]>([]);

  // Подборка фиксируется по банку и цели: reload не должен перетасовать вопросы
  // посреди прогона, поэтому она мемоизируется, а не пересчитывается на каждый пик.
  const demo = useMemo(
    () => pickDemoQuestions(bank, goalId ?? 'onboarding'),
    [bank, goalId],
  );

  const isEmpty = demo.length === 0;

  useEffect(() => {
    if (isEmpty) navigateTo('onboarding-result');
  }, [isEmpty, navigateTo]);

  const question = demo[index];
  const isLast = index === demo.length - 1;

  const handleAnswer = (optionIndex: number) => {
    if (!question || picked !== null) return;
    setPicked(optionIndex);
  };

  const handleNext = () => {
    if (!question || picked === null) return;
    const next = [...answers, { isCorrect: question.options[picked].correct }];
    setAnswers(next);
    setPicked(null);
    if (isLast) {
      // Единственная точка записи итога: экран результата только читает канал.
      setDemoAnswers(next);
      navigateTo('onboarding-result');
      return;
    }
    setIndex(index + 1);
  };

  if (!question) {
    // Пустой банк уже уводится эффектом выше; до перехода рендерим пустой
    // контейнер, чтобы не мигать вёрсткой вопроса, которого нет.
    return <ScreenContainer data-testid="onboarding-demo">{null}</ScreenContainer>;
  }

  return (
    <ScreenContainer data-testid="onboarding-demo">
      <p
        data-testid="onboarding-demo-progress"
        style={{ margin: 0, fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}
      >
        {`Вопрос ${index + 1} из ${demo.length}`}
      </p>

      <h1
        style={{
          fontSize: 18,
          fontWeight: 600,
          lineHeight: 1.4,
          margin: `${SPACING.md} 0 0 0`,
          color: 'var(--text-primary)',
        }}
      >
        {question.question}
      </h1>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.sm,
          marginTop: SPACING.lg,
        }}
      >
        {question.options.map((option, optionIndex) => {
          const selected = picked === optionIndex;
          return (
            <button
              key={option.text}
              type="button"
              data-testid={`onboarding-option-${optionIndex}`}
              onClick={() => handleAnswer(optionIndex)}
              style={{
                width: '100%',
                minHeight: 44,
                padding: SPACING.md,
                background: selected ? 'rgba(33,150,243,0.10)' : 'var(--bg-surface)',
                border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                borderRadius: LAYOUT.buttonRadius,
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                fontSize: 'var(--text-sm)',
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              {option.text}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        data-testid="onboarding-demo-next"
        disabled={picked === null}
        onClick={handleNext}
        style={{
          width: '100%',
          marginTop: SPACING.lg,
          padding: SPACING.md,
          background: picked === null ? 'var(--bg-surface)' : 'var(--accent)',
          // spec 079: белый на акцентной заливке (5.75:1); у disabled фон
          // `--bg-surface` — там тёмный `--text-secondary`.
          color: picked === null ? 'var(--text-secondary)' : 'var(--btn-primary-text)',
          border: 'none',
          borderRadius: LAYOUT.buttonRadius,
          fontSize: 'var(--body)',
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: picked === null ? 'not-allowed' : 'pointer',
          opacity: picked === null ? 0.5 : 1,
        }}
      >
        {isLast ? 'Показать результат' : 'Дальше'}
      </button>
    </ScreenContainer>
  );
}
