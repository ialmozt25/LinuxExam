import { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { useQuizStore } from '@/store/quizStore';
import { SPACING, LAYOUT } from '@/presentation/theme';
import { isTMA } from '@telegram-apps/sdk-react';
import Paywall from '@/presentation/screens/Paywall';
import { MotionButton } from '@/presentation/components/MotionButton';
import { AppHeader } from '@/presentation/components/AppHeader';
import { useExamTimer } from '@/hooks/useExamTimer';
import { shuffleOptions, seedFromId } from '@/domain/quizService';
import { useTelegramMainButton } from '@/hooks/useTelegramMainButton';
import { useTelegramBackButton } from '@/hooks/useTelegramBackButton';
import { impact, notify } from '@/hooks/useTelegramHaptics';
import { ScreenContainer } from '@/presentation/components/ScreenContainer';

type OptionLike = { text: string; correct: boolean };

/**
 * Deterministic option order for one question: the same id always yields the
 * same order, so there is no re-shuffle flicker and no test flakiness. The
 * arguments are primitives/id-scoped so the memo depends on nothing unstable.
 */
function orderOptions(questionId: string | null, options?: ReadonlyArray<OptionLike>) {
  if (!questionId || !options) return [];
  return shuffleOptions(options, seedFromId(questionId));
}
export default function Question() {
  const allQuestions = useQuizStore((s) => s.questions);
  const reviewQuestionIds = useQuizStore((s) => s.reviewQuestionIds);
  const reviewAnswers = useQuizStore((s) => s.reviewAnswers);
  const answerReview = useQuizStore((s) => s.answerReview);
  const examActive = useQuizStore((s) => s.examActive);
  const examQuestionIds = useQuizStore((s) => s.examQuestionIds);
  const examAnswers = useQuizStore((s) => s.examAnswers);
  const answerExam = useQuizStore((s) => s.answerExam);
  const finishExam = useQuizStore((s) => s.finishExam);
  const cancelExam = useQuizStore((s) => s.cancelExam);
  const currentIndex = useQuizStore((s) => s.currentIndex);
  const answers = useQuizStore((s) => s.answers);
  const answerQuestion = useQuizStore((s) => s.answerQuestion);
  const nextQuestion = useQuizStore((s) => s.nextQuestion);
  const previousQuestion = useQuizStore((s) => s.previousQuestion);
  const isPaywallVisible = useQuizStore((s) => s.isPaywallVisible);
  const navigateTo = useQuizStore((s) => s.navigateTo);
  const reduceMotion = useReducedMotion();
  const explanationRef = useRef<HTMLDivElement>(null);
  const { display: timerDisplay } = useExamTimer();
  const [showConfirm, setShowConfirm] = useState(false);

  const isReview = reviewQuestionIds !== null;

  // Active question set. Exam takes precedence, then review, then regular.
  // useMemo keeps the reference stable so derived values do not recompute.
  const activeQuestions = useMemo(() => {
    if (examActive) return allQuestions.filter((q) => examQuestionIds.includes(q.id));
    if (reviewQuestionIds) return allQuestions.filter((q) => reviewQuestionIds.includes(q.id));
    return allQuestions;
  }, [examActive, examQuestionIds, reviewQuestionIds, allQuestions]);

  const currentQuestion = activeQuestions[currentIndex] ?? null;
  const totalQuestions = activeQuestions.length;
  const questionId = currentQuestion?.id ?? null;

  // Deterministic per-question option order. MUST stay above the conditional
  // returns below (Rules of Hooks). Dependencies are the id and the options of
  // the current question only, so the order never re-shuffles on a re-render.
  const questionOptions = currentQuestion?.options;
  const shuffledOptions = useMemo(
    () => orderOptions(questionId, questionOptions),
    [questionId, questionOptions]
  );

  // Exactly one answer stream is active. They never mix.
  const activeAnswers = examActive ? examAnswers : isReview ? reviewAnswers : answers;
  const answerFn = examActive ? answerExam : isReview ? answerReview : answerQuestion;

  // Derived values are computed BEFORE the early returns below so the Telegram
  // hooks can be called unconditionally (rules of hooks require it).
  const existingAnswer = currentQuestion
    ? activeAnswers.find((a) => a.questionId === currentQuestion.id)
    : undefined;
  const hasAnswered = existingAnswer !== undefined;
  const isCorrectAnswer = existingAnswer?.isCorrect ?? false;
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const isLastExamQuestion = examActive && isLastQuestion;
  // Review starts at index 0 like every other stream, so the back control has
  // history exactly when a previous question exists. The old 'isReview ? true'
  // branch advertised a back button on the first review question, where
  // previousQuestion() is a no-op and the Telegram BackButton is already hidden.
  const hasHistory = examActive ? false : currentIndex > 0;
  const isTelegram = isTMA();

  useTelegramMainButton(
    isLastExamQuestion ? 'Завершить экзамен' : isLastQuestion ? 'Завершить' : 'Следующий вопрос',
    () => {
      impact('light');
      if (isLastExamQuestion) finishExam();
      else if (isLastQuestion) navigateTo('results');
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

  // Auto-scroll to the explanation once the current question is answered.
  // Dependency key is selectedIndex — not the object — so it triggers
  // only when a new answer appears for the current question.
  const answerKey = existingAnswer?.selectedIndex ?? -1;

  useEffect(() => {
    if (answerKey < 0) return;
    const el = explanationRef.current;
    if (!el) return;

    const root = document.getElementById('root');
    if (!root) return;
    if (typeof root.scrollTo !== 'function') return;

    // 350ms — explanation enter-animation (250ms) + buffer.
    const t = window.setTimeout(() => {
      try {
        const elRect = el.getBoundingClientRect();
        const rootRect = root.getBoundingClientRect();

        // Absolute position of the explanation within the scrollable content.
        const elTop = elRect.top - rootRect.top + root.scrollTop;
        const elHeight = elRect.height;
        const rootHeight = rootRect.height;

        // Skip if already fully visible (with a 16px margin).
        const alreadyVisible =
          elTop >= root.scrollTop + 16 && elTop + elHeight <= root.scrollTop + rootHeight - 16;
        if (alreadyVisible) return;

        const padding = 24; // breathing room
        let target: number;

        if (elHeight + padding * 2 <= rootHeight) {
          // Short explanation: center it vertically.
          target = elTop - (rootHeight - elHeight) / 2;
        } else {
          // Tall explanation: align its top with padding.
          target = elTop - padding;
        }

        // Clamp to the valid scroll range.
        const maxScroll = Math.max(0, root.scrollHeight - rootHeight);
        target = Math.max(0, Math.min(target, maxScroll));

        root.scrollTo({ top: target, behavior: 'smooth' });
      } catch {
        // jsdom does not implement scrollTo — silent bail.
      }
    }, 350);

    return () => window.clearTimeout(t);
  }, [answerKey]);

  // Paywall state (Paywall renders its own ScreenContainer — wrapping here would
  // double the padding/safe-area insets, so this early return stays unwrapped).
  // Review mode is a study mode and is never paywalled.
  if (isPaywallVisible && !isReview) {
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
            background: 'var(--accent)',
            color: 'var(--text-primary)',
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
    impact('light');
    answerFn(currentQuestion.id, index);
    // Exam mode gives NO immediate feedback - no notify() at all.
    if (examActive) return;
    // Let the answer render first, then confirm it with the matching haptic pattern.
    const correct = currentQuestion.options[index].correct;
    setTimeout(() => (correct ? notify('success') : notify('error')), 100);
  };

  const handleHomeClick = () => {
    if (examActive) setShowConfirm(true);
    else navigateTo('dashboard');
  };

  return (
    <ScreenContainer>
      <AppHeader
        onBack={hasHistory ? () => previousQuestion() : undefined}
        onHome={handleHomeClick}
        center={
          examActive
            ? `${currentIndex + 1} / ${totalQuestions}  ·  ${timerDisplay}`
            : `${currentIndex + 1} / ${totalQuestions}`
        }
      />

      {/* Progress line */}
      <div
        style={{
          height: '3px',
          background: 'var(--bg-elevated)',
          borderRadius: '2px',
          marginBottom: SPACING.lg,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progressPercent}%`,
            height: '100%',
            background: 'var(--accent)',
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
        {shuffledOptions.map((option, visualIndex) => {
          // originalIndex is the position in the stored options array: it is what
          // gets persisted and what all correctness logic must use.
          const originalIndex = option.originalIndex;
          const isSelected = existingAnswer?.selectedIndex === originalIndex;
          const isRevealedCorrect = hasAnswered && !isSelected && option.correct;

          // Border WIDTH is constant (2px) in every state - selecting an option
          // must never shift layout. Only color, background, box-shadow and
          // opacity change. The 3px inset bar marks the user's own pick.
          let backgroundColor = 'var(--bg-elevated)';
          let borderColor = 'var(--border-subtle)';
          let boxShadow = 'none';
          let opacity = 1;

          if (examActive && isSelected) {
            // Exam: mark the pick with the accent colour only. Never reveal
            // whether it was right or wrong.
            backgroundColor = 'rgba(33,150,243,0.08)';
            borderColor = 'var(--accent)';
          } else if (!examActive && hasAnswered && existingAnswer) {
            if (isSelected && existingAnswer.isCorrect) {
              backgroundColor = 'rgba(76,175,80,0.15)';
              borderColor = '#4CAF50';
              boxShadow = 'inset 3px 0 0 #4CAF50';
            } else if (isSelected && !existingAnswer.isCorrect) {
              backgroundColor = 'rgba(244,67,54,0.15)';
              borderColor = '#F44336';
              boxShadow = 'inset 3px 0 0 #F44336';
            } else if (isRevealedCorrect) {
              backgroundColor = 'transparent';
              borderColor = '#4CAF50';
            } else {
              opacity = 0.55;
            }
          }
          const shouldPulse = hasAnswered && option.correct;

          return (
            <motion.div
              key={option.originalIndex}
              animate={shouldPulse && !reduceMotion ? { scale: [1, 1.05, 1] } : { scale: 1 }}
              transition={{ duration: 0.3 }}
            >
              <MotionButton
                type="button"
                disabled={hasAnswered}
                aria-label={`Ответ ${String.fromCharCode(65 + visualIndex)}: ${option.text}`}
                onClick={() => handleOption(originalIndex)}
                whileTap={
                  reduceMotion ? {} : { scale: 0.98, backgroundColor: 'rgba(33,150,243,0.15)' }
                }
                whileHover={reduceMotion ? {} : { borderColor: 'rgba(255,255,255,0.15)' }}
                style={{
                  background: backgroundColor,
                  color: 'var(--text-primary)',
                  padding: SPACING.md,
                  borderRadius: '12px',
                  border: `2px solid ${borderColor}`,
                  boxShadow,
                  textAlign: 'left',
                  cursor: hasAnswered ? 'default' : 'pointer',
                  fontSize: 14,
                  lineHeight: 1.5,
                  fontFamily: 'inherit',
                  transition: 'background 0.15s ease, border-color 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: SPACING.sm,
                  opacity: hasAnswered ? opacity : 1,
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
                  {String.fromCharCode(65 + visualIndex)}
                </span>
                <span>{option.text}</span>
              </MotionButton>
            </motion.div>
          );
        })}
      </div>

      {/* Explanation - only if answered */}
      <AnimatePresence>
        {hasAnswered && !examActive && (
          <motion.div
            initial={reduceMotion ? false : { opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            style={{
              marginTop: SPACING.lg,
              padding: SPACING.md,
              background: 'var(--bg-surface)',
              borderRadius: LAYOUT.cardRadius,
              borderLeft: `4px solid ${isCorrectAnswer ? 'var(--success)' : 'var(--danger)'}`,
            }}
          >
            <div
              style={{
                fontSize: 12,
                color: 'var(--text-secondary)',
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
              style={{
                fontSize: 14,
                color: 'var(--text-primary)',
                lineHeight: 1.5,
                paddingBottom: '32px',
              }}
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
            if (isLastExamQuestion) finishExam();
            else if (isLastQuestion) navigateTo('results');
            else nextQuestion();
          }}
          style={{
            width: '100%',
            padding: SPACING.md,
            background: hasAnswered ? 'var(--accent)' : 'var(--bg-surface)',
            color: 'var(--text-primary)',
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
          {isLastExamQuestion ? 'Завершить экзамен' : isLastQuestion ? 'Завершить' : 'Следующий вопрос'}{' '}
          <ChevronRight size={20} />
        </button>
      )}
      {showConfirm && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: 'var(--space-4)',
          }}
        >
          <div
            style={{
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-4)',
              maxWidth: 320,
              width: '100%',
              fontFamily: 'inherit',
            }}
          >
            <div
              style={{
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                marginBottom: 'var(--space-2)',
              }}
            >
              Выйти из экзамена?
            </div>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                marginBottom: 'var(--space-4)',
              }}
            >
              Прогресс будет потерян.
            </div>
            <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                style={{
                  flex: 1,
                  padding: 'var(--space-3)',
                  background: 'var(--accent)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Остаться
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowConfirm(false);
                  cancelExam();
                }}
                style={{
                  flex: 1,
                  padding: 'var(--space-3)',
                  background: 'transparent',
                  color: 'var(--text-primary)',
                  border: '1px solid var(--border-strong)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Выйти
              </button>
            </div>
          </div>
        </div>
      )}
    </ScreenContainer>
  );
}
