import { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useQuizStore } from '@/store/quizStore';
import { COLORS, SPACING, LAYOUT } from '@/presentation/theme';
import { isTMA } from '@telegram-apps/sdk-react';
import Paywall from '@/presentation/screens/Paywall';
import { MotionButton } from '@/presentation/components/MotionButton';
import { useTelegramMainButton } from '@/hooks/useTelegramMainButton';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { impact, notify } from '@/hooks/useTelegramHaptics';
import { ScreenContainer } from '@/presentation/components/ScreenContainer';

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
  const reduceMotion = useReducedMotion();
  const explanationRef = useRef<HTMLDivElement>(null);

  // Derived values are computed BEFORE the early returns below so the Telegram
  // hooks can be called unconditionally (rules of hooks require it).
  const existingAnswer = currentQuestion
    ? answers.find((a) => a.questionId === currentQuestion.id)
    : undefined;
  const hasAnswered = existingAnswer !== undefined;
  const isCorrectAnswer = existingAnswer?.isCorrect ?? false;
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const isTelegram = isTMA();

  useTelegramMainButton(
    isLastQuestion ? 'Завершить' : 'Следующий вопрос',
    () => {
      impact('light');
      if (isLastQuestion) navigateTo('results');
      else nextQuestion();
    },
    hasAnswered
  );

  useTelegramBackButton(() => {
    impact('light');
    previousQuestion();
  }, currentIndex > 0);

  // Reset scroll when the question changes (must stay before any conditional return).
  useEffect(() => {
    // #root is the sole scroll container (html/body are overflow:hidden), with fallbacks.
    const el =
      document.getElementById('root') ?? document.scrollingElement ?? document.documentElement;
    el.scrollTop = 0;
  }, [currentIndex]);

  // Auto-scroll to the explanation once the current question has been answered.
  useEffect(() => {
    if (!existingAnswer) return;
    const el = explanationRef.current;
    // jsdom (tests) does not implement scrollIntoView — bail out instead of throwing.
    if (!el || typeof el.scrollIntoView !== 'function') return;
    // 200ms lets the explanation enter-animation start before scrolling.
    const t = window.setTimeout(() => {
      el.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }, 200);
    return () => window.clearTimeout(t);
  }, [existingAnswer]);

  // Paywall state (Paywall renders its own ScreenContainer — wrapping here would
  // double the padding/safe-area insets, so this early return stays unwrapped).
  if (isPaywallVisible) {
    return <Paywall />;
  }

  // No question loaded
  if (!currentQuestion) {
    return (
      <ScreenContainer>
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
      </ScreenContainer>
    );
  }

  // Safe computations AFTER guards
  const progressPercent = totalQuestions > 0 ? ((currentIndex + 1) / totalQuestions) * 100 : 0;

  const handleOption = (index: number) => {
    const correct = currentQuestion.options[index].correct;
    impact('light');
    answerQuestion(currentQuestion.id, index);
    // Let the answer render first, then confirm it with the matching haptic pattern.
    setTimeout(() => (correct ? notify('success') : notify('error')), 100);
  };

  return (
    <ScreenContainer>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          marginBottom: SPACING.lg,
        }}
      >
        {isTelegram && <div style={{ minWidth: '44px' }} aria-hidden="true" />}
        {!isTelegram && (
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
              minWidth: '44px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
            }}
          >
            <ChevronLeft size={20} color={COLORS.textSecondary} />
          </button>
        )}
        <div style={{ color: COLORS.textSecondary, fontSize: 14, flex: 1, textAlign: 'center' }}>
          {`${currentIndex + 1} / ${totalQuestions}`}
        </div>
        <div style={{ minWidth: '44px' }} aria-hidden="true" />
      </div>

      {/* Progress line */}
      <div
        style={{
          height: '3px',
          background: 'rgba(255,255,255,0.08)',
          borderRadius: '2px',
          marginBottom: SPACING.lg,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progressPercent}%`,
            height: '100%',
            background: COLORS.primary,
            boxShadow: '0 0 8px rgba(33,150,243,0.5)',
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      {/* Question */}
      <h2
        style={{
          fontSize: '19px',
          fontWeight: 600,
          lineHeight: '1.45',
          margin: 0,
          marginBottom: SPACING.md,
        }}
      >
        {currentQuestion.question}
      </h2>

      {/* Options */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: SPACING.md,
          marginTop: SPACING.lg,
        }}
      >
        {currentQuestion.options.map((option, index) => {
          const isSelected = existingAnswer?.selectedIndex === index;
          let backgroundColor: string = '#252525';
          if (hasAnswered && existingAnswer) {
            if (isSelected && existingAnswer.isCorrect) {
              backgroundColor = COLORS.correct;
            } else if (isSelected && !existingAnswer.isCorrect) {
              backgroundColor = COLORS.wrong;
            } else if (!isSelected && option.correct) {
              backgroundColor = COLORS.surfaceHover;
            }
          }
          const shouldPulse = hasAnswered && option.correct;

          return (
            <motion.div
              key={index}
              animate={shouldPulse && !reduceMotion ? { scale: [1, 1.05, 1] } : { scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <MotionButton
                type="button"
                disabled={hasAnswered}
                aria-label={`Ответ ${String.fromCharCode(65 + index)}: ${option.text}`}
                onClick={() => handleOption(index)}
                whileTap={
                  reduceMotion ? {} : { scale: 0.98, backgroundColor: 'rgba(33,150,243,0.15)' }
                }
                whileHover={reduceMotion ? {} : { borderColor: 'rgba(255,255,255,0.15)' }}
                style={{
                  background: backgroundColor,
                  color: COLORS.textPrimary,
                  padding: SPACING.md,
                  borderRadius: '12px',
                  border: '1px solid rgba(255,255,255,0.06)',
                  textAlign: 'left',
                  cursor: hasAnswered ? 'default' : 'pointer',
                  fontSize: 14,
                  lineHeight: 1.5,
                  fontFamily: 'inherit',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACING.sm,
                  opacity: 1,
                  width: '100%',
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
              </MotionButton>
            </motion.div>
          );
        })}
      </div>

      {/* Explanation - only if answered */}
      <AnimatePresence>
        {hasAnswered && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
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
            <div
              ref={explanationRef}
              style={{ fontSize: 14, color: COLORS.textPrimary, lineHeight: 1.5 }}
            >
              {currentQuestion.explanation}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Next button (in-app fallback: hidden in Telegram, where MainButton takes over) */}
      {!isTelegram && (
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
      )}
    </ScreenContainer>
  );
}
