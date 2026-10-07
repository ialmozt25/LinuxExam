import { useMemo, useState } from 'react';
import { Check, X } from 'lucide-react';
import { useQuizStore } from '@/store/quizStore';
import { ScreenContainer } from '@/presentation/components/ScreenContainer';
import { SPACING, LAYOUT } from '@/presentation/theme';
import { demoAnswerFeedback, pickDemoQuestions } from '@/domain/onboarding';

/**
 * Онбординг (spec 060, упрощён) — ЕДИНСТВЕННЫЙ экран онбординга: демо-квиз.
 *
 * Было четыре экрана (цель → демо → «Готово · 1 из 3» → daily goal picker).
 * Стало два шага: этот экран и Dashboard в Fresh User Mode. Поэтому:
 * - фидбек приходит ИНЛАЙН после каждого ответа (галочка/крестик + текст), а не
 *   отдельным экраном-итогом;
 * - финальная кнопка сразу уводит на Dashboard («Начать обучение →») и помечает
 *   прохождение онбординга — пикера дневной цели на этом пути больше нет
 *   (`completeOnboarding` фиксирует дефолтную цель, см. quizStore).
 *
 * Ответы живут только в локальном состоянии компонента: демо не должно попадать
 * ни в `questionStats`, ни в `answers` настоящего пользователя — иначе первый же
 * ответ в онбординге выключил бы Fresh User Mode на Dashboard.
 *
 * Пустой банк (чанки ещё не пришли) недостижим за гейтом `isLoading` в App.tsx,
 * но экран обязан оставить выход: показывается та же финальная кнопка.
 */

const FINAL_LABEL = 'Начать обучение →';

/** Финальная CTA. Одна и та же в обоих состояниях экрана (вопрос есть / банк пуст). */
function StartButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      data-testid="onboarding-demo-next"
      onClick={onClick}
      style={{
        width: '100%',
        marginTop: SPACING.lg,
        padding: SPACING.md,
        background: 'var(--accent)',
        color: 'var(--btn-primary-text)',
        border: 'none',
        borderRadius: LAYOUT.buttonRadius,
        fontSize: 'var(--body)',
        fontWeight: 600,
        fontFamily: 'inherit',
        cursor: 'pointer',
      }}
    >
      {FINAL_LABEL}
    </button>
  );
}

export default function OnboardingDemo() {
  const bank = useQuizStore((s) => s.questions);
  const navigateTo = useQuizStore((s) => s.navigateTo);
  const completeOnboarding = useQuizStore((s) => s.completeOnboarding);

  const [index, setIndex] = useState<number>(0);
  const [picked, setPicked] = useState<number | null>(null);

  // Подборка фиксируется по банку: reload не должен перетасовать вопросы посреди
  // прогона, поэтому она мемоизируется, а не пересчитывается на каждый пик.
  const demo = useMemo(() => pickDemoQuestions(bank), [bank]);

  const question = demo[index];
  const isLast = index === demo.length - 1;
  // `null` — ответа ещё нет; иначе вердикт выбранной опции (для inline celebration).
  const verdict = question !== undefined && picked !== null ? question.options[picked].correct : null;

  const finish = () => {
    // Единственная точка выхода: помечаем прохождение и уходим на Dashboard —
    // он покажет Fresh User Mode, пока ответов нет.
    completeOnboarding();
    navigateTo('dashboard');
  };

  const handleAnswer = (optionIndex: number) => {
    // Первый клик фиксирует ответ: менять его после вердикта нельзя.
    if (question === undefined || picked !== null) return;
    setPicked(optionIndex);
  };

  const handleNext = () => {
    if (picked === null) return;
    if (isLast) {
      finish();
      return;
    }
    setIndex(index + 1);
    setPicked(null);
  };

  if (!question) {
    return (
      <ScreenContainer data-testid="onboarding-demo">
        <StartButton onClick={finish} />
      </ScreenContainer>
    );
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
          // Ответ дан: выбранная опция подсвечивается статусом (--success/--danger),
          // остальные остаются нейтральными. Вердикт дублируется текстом ниже, а не
          // только цветом — цвет не единственный носитель смысла.
          const answered = picked !== null && selected;
          const border = answered
            ? option.correct
              ? 'var(--success)'
              : 'var(--danger)'
            : selected
              ? 'var(--accent)'
              : 'var(--border-subtle)';
          return (
            <button
              key={option.text}
              type="button"
              data-testid={`onboarding-option-${optionIndex}`}
              disabled={picked !== null}
              aria-disabled={picked !== null}
              onClick={() => handleAnswer(optionIndex)}
              style={{
                width: '100%',
                minHeight: 44,
                padding: SPACING.md,
                background: selected ? 'rgba(33,150,243,0.10)' : 'var(--bg-surface)',
                border: `1px solid ${border}`,
                borderRadius: LAYOUT.buttonRadius,
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                fontSize: 'var(--text-sm)',
                textAlign: 'left',
                cursor: picked === null ? 'pointer' : 'default',
              }}
            >
              {option.text}
            </button>
          );
        })}
      </div>

      {/* Inline celebration (spec: фидбек после каждого ответа). `role="status"` —
          вердикт объявляется скринридеру, а не только показывается. */}
      {verdict !== null && (
        <div
          data-testid="onboarding-feedback"
          data-correct={verdict}
          role="status"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: SPACING.sm,
            marginTop: SPACING.md,
            padding: SPACING.md,
            background: 'var(--bg-surface)',
            border: `1px solid ${verdict ? 'var(--success)' : 'var(--danger)'}`,
            borderRadius: LAYOUT.cardRadius,
            color: verdict ? 'var(--success)' : 'var(--danger)',
            fontSize: 'var(--body)',
            fontWeight: 600,
          }}
        >
          {verdict ? <Check size={18} aria-hidden="true" /> : <X size={18} aria-hidden="true" />}
          <span data-testid="onboarding-feedback-text">{demoAnswerFeedback(verdict)}</span>
        </div>
      )}

      {isLast ? (
        <StartButton onClick={handleNext} />
      ) : (
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
          Дальше
        </button>
      )}
    </ScreenContainer>
  );
}
