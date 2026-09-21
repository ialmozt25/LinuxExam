import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuizStore } from '@/store/quizStore';
import { COLORS, SPACING, LAYOUT } from '@/presentation/theme';
import Paywall from '@/presentation/screens/Paywall';

export default function Question() {
  const currentQuestion = useQuizStore((s) => s.questions[s.currentIndex] ?? null);
  const currentIndex = useQuizStore((s) => s.currentIndex);
  const totalQuestions = useQuizStore((s) => s.questions.length);
  const answers = useQuizStore((s) => s.answers);
  const answerQuestion = useQuizStore((s) => s.answerQuestion);
  const nextQuestion = useQuizStore((s) => s.nextQuestion);
  const previousQuestion = useQuizStore((s) => s.previousQuestion);
  const isPaywallVisible = useQuizStore((s) => s.isPaywallVisible);
  const navigateTo = useQuizStore((s) => s.navigateTo);

  // Paywall state
  if (isPaywallVisible) {
    return <Paywall />;
  }

  // No question loaded
  if (!currentQuestion) {
    return (
      <div
        style={{
          minHeight: '100dvh',
          background: COLORS.background,
          color: COLORS.textPrimary,
          padding: SPACING.md,
          maxWidth: LAYOUT.containerMaxWidth,
          margin: '0 auto',
        }}
      >
        <p>Вопросы не загружены</p>
        <button
          type="button"
          onClick={() => navigateTo('dashboard')}
          style={{
            background: COLORS.primary,
            color: COLORS.textPrimary,
            padding: SPACING.md,
            borderRadius: LAYOUT.buttonRadius,
            border: 'none',
            fontSize: 14,
            cursor: 'pointer',
            fontFamily: 'inherit',
            marginTop: SPACING.md,
          }}
        >
          К темам
        </button>
      </div>
    );
  }

  // Safe computations AFTER guards
  const existingAnswer = answers.find((a) => a.questionId === currentQuestion.id);
  const hasAnswered = existingAnswer !== undefined;
  const isCorrectAnswer = existingAnswer?.isCorrect ?? false;
  const progressPercent = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;
  const isLastQuestion = currentIndex === totalQuestions - 1;

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: COLORS.background,
        color: COLORS.textPrimary,
        padding: SPACING.md,
        maxWidth: LAYOUT.containerMaxWidth,
        margin: '0 auto',
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: SPACING.lg,
        }}
      >
        <button
          type="button"
          onClick={() => previousQuestion()}
          disabled={currentIndex === 0}
          aria-label="Предыдущий вопрос"
          style={{
            background: 'transparent',
            border: 'none',
            cursor: currentIndex === 0 ? 'not-allowed' : 'pointer',
            opacity: currentIndex === 0 ? 0.3 : 1,
            padding: SPACING.xs,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          <ChevronLeft size={20} color={COLORS.textSecondary} />
        </button>
        <div style={{ color: COLORS.textSecondary, fontSize: 14 }}>
          {`${currentIndex + 1} / ${totalQuestions}`}
        </div>
        <div style={{ width: 28 }} aria-hidden="true" />
      </div>

      {/* Progress line */}
      <div
        style={{
          height: LAYOUT.progressLineHeight,
          background: COLORS.surface,
          marginBottom: SPACING.xl,
          borderRadius: LAYOUT.progressLineRadius,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progressPercent}%`,
            height: '100%',
            background: COLORS.primary,
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Question */}
      <h2 style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.4, margin: 0 }}>
        {currentQuestion.question}
      </h2>

      {/* Options */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.md,
          marginTop: SPACING.xl,
        }}
      >
        {currentQuestion.options.map((option, index) => {
          const isSelected = existingAnswer?.selectedIndex === index;
          let backgroundColor: string = COLORS.surface;
          if (hasAnswered && existingAnswer) {
            if (isSelected && existingAnswer.isCorrect) {
              backgroundColor = COLORS.correct;
            } else if (isSelected && !existingAnswer.isCorrect) {
              backgroundColor = COLORS.wrong;
            } else if (!isSelected && option.correct) {
              backgroundColor = COLORS.surfaceHover;
            }
          }
          return (
            <button
              key={index}
              type="button"
              disabled={hasAnswered}
              onClick={() => answerQuestion(currentQuestion.id, index)}
              style={{
                background: backgroundColor,
                color: COLORS.textPrimary,
                padding: SPACING.md,
                borderRadius: LAYOUT.cardRadius,
                border: 'none',
                textAlign: 'left',
                cursor: hasAnswered ? 'default' : 'pointer',
                fontSize: 14,
                lineHeight: 1.5,
                fontFamily: 'inherit',
                transition: 'background 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: SPACING.sm,
                opacity: 1,
              }}
            >
              <span
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: '50%',
                  background: 'rgba(255,255,255,0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {String.fromCharCode(65 + index)}
              </span>
              <span>{option.text}</span>
            </button>
          );
        })}
      </div>

      {/* Explanation - only if answered */}
      {hasAnswered && (
        <div
          style={{
            marginTop: SPACING.lg,
            padding: SPACING.md,
            background: COLORS.surface,
            borderRadius: LAYOUT.cardRadius,
            borderLeft: `4px solid ${isCorrectAnswer ? COLORS.correct : COLORS.wrong}`,
          }}
        >
          <div
            style={{
              fontSize: 12,
              color: COLORS.textSecondary,
              marginBottom: SPACING.xs,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
              fontWeight: 600,
            }}
          >
            {isCorrectAnswer ? 'Верно' : 'Неверно'}
          </div>
          <div style={{ fontSize: 14, color: COLORS.textPrimary, lineHeight: 1.5 }}>
            {currentQuestion.explanation}
          </div>
        </div>
      )}

      {/* Next button */}
      <button
        type="button"
        disabled={!hasAnswered}
        onClick={() => {
          if (isLastQuestion) navigateTo('results');
          else nextQuestion();
        }}
        style={{
          width: '100%',
          padding: SPACING.md,
          background: hasAnswered ? COLORS.primary : COLORS.surface,
          color: COLORS.textPrimary,
          border: 'none',
          borderRadius: LAYOUT.buttonRadius,
          fontSize: 16,
          fontWeight: 600,
          cursor: hasAnswered ? 'pointer' : 'not-allowed',
          fontFamily: 'inherit',
          opacity: hasAnswered ? 1 : 0.5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: SPACING.sm,
          marginTop: SPACING.xl,
        }}
      >
        {isLastQuestion ? 'Завершить' : 'Следующий вопрос'} <ChevronRight size={20} />
      </button>
    </div>
  );
}
