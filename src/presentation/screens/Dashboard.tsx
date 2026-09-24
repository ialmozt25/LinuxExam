import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Flame, MoonStar, Sun } from 'lucide-react';
import { useQuizStore } from '@/store/quizStore';
import { SPACING, LAYOUT } from '@/presentation/theme';
import { isTMA } from '@telegram-apps/sdk-react';
import { useTelegramMainButton } from '@/hooks/useTelegramMainButton';
import { ScreenContainer } from '@/presentation/components/ScreenContainer';
import { useExamTimer } from '@/hooks/useExamTimer';
import { TOPICS, AVAILABLE_TOPICS } from '@/data/topics';
import { getBankTotal, getTopicCount } from '@/data/questions';
import type { ResolvedTheme } from '@/utils/theme';

interface Props {
  /** Theme currently in effect, owned by useThemeController in App. */
  theme: ResolvedTheme;
  /** Flips the theme, or returns to inherit when it matches the system one. */
  onToggleTheme: () => void;
}

export default function Dashboard({ theme, onToggleTheme }: Props) {
  // Counts come from the bank manifest (≈260 B) rather than from the loaded bank:
  // the Dashboard must show real numbers before the topic chunks arrive.
  const navigateTo = useQuizStore((s) => s.navigateTo);
  const streak = useQuizStore((s) => s.streak);
  const totalXp = useQuizStore((s) => s.totalXp);
  const isQuizInProgress = useQuizStore((s) => s.isQuizInProgress);
  const currentIndex = useQuizStore((s) => s.currentIndex);
  const reviewQuestionIds = useQuizStore((s) => s.reviewQuestionIds);
  const resumeQuiz = useQuizStore((s) => s.resumeQuiz);
  const examActive = useQuizStore((s) => s.examActive);
  const startRegularQuiz = useQuizStore((s) => s.startRegularQuiz);
  const startExam = useQuizStore((s) => s.startExam);
  const startTopicQuiz = useQuizStore((s) => s.startTopicQuiz);
  const wrongQuestionIds = useQuizStore((s) => s.wrongQuestionIds);
  const startReviewQuiz = useQuizStore((s) => s.startReviewQuiz);

  // CRITICAL: useShallow with PRIMITIVES ONLY.
  // getProgress() returns a new object each call. useShallow on the full
  // object still re-renders because the object reference changes.
  // Solution: return only primitives from the selector.
  const { answered } = useQuizStore(
    useShallow((s) => {
      const p = s.getProgress();
      return { answered: p.answered };
    })
  );

  const isTelegram = isTMA();
  const { display: timerDisplay } = useExamTimer();


  useTelegramMainButton('Продолжить', () => navigateTo('question'));

  // Reset scroll when the dashboard mounts.
  useEffect(() => {
    const el =
      document.getElementById('root') ?? document.scrollingElement ?? document.documentElement;
    el.scrollTop = 0;
  }, []);


  const totalQuestions = getBankTotal();
  const progressPercent = totalQuestions > 0 ? (answered / totalQuestions) * 100 : 0;
  const level = Math.floor(totalXp / 100) + 1;
  const xpPercent = totalXp % 100;

  return (
    <ScreenContainer>
      {/* Status strip */}
      <div
        id="status-strip"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: '12px',
          borderBottom: '1px solid var(--border-subtle)',
          fontSize: '13px',
          color: 'var(--text-secondary)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <Flame size={16} color="var(--warning)" aria-hidden="true" />
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{streak}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Уровень {level}</span>
          <span
            role="progressbar"
            aria-valuenow={xpPercent}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Прогресс уровня"
            style={{
              display: 'inline-block',
              width: '40px',
              height: '4px',
              background: 'var(--bg-surface)',
              borderRadius: '2px',
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                display: 'block',
                width: `${xpPercent}%`,
                height: '100%',
                background: 'var(--accent)',
                transition: 'width 0.3s ease',
              }}
            />
          </span>
          <button
            type="button"
            onClick={onToggleTheme}
            aria-label={
              theme === 'light' ? 'Переключить на тёмную' : 'Переключить на светлую'
            }
            style={{
              minWidth: 44,
              minHeight: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              color: 'var(--text-secondary)',
            }}
          >
            {theme === 'light' ? (
              <Sun size={20} color="var(--text-secondary)" aria-hidden="true" />
            ) : (
              <MoonStar size={20} color="var(--text-secondary)" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* Title block */}
      <div style={{ marginTop: '24px' }}>
        <h1
          style={{
            fontSize: '28px',
            fontWeight: 700,
            letterSpacing: '-0.5px',
            margin: 0,
            color: 'var(--text-primary)',
          }}
        >
          LinuxExam
        </h1>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--text-secondary)',
            letterSpacing: '0.3px',
            textTransform: 'uppercase',
            margin: '4px 0 0 0',
          }}
        >
          Подготовка к RHCSA за 15 минут в день
        </p>
      </div>

      {/* Progress */}
      <div style={{ marginTop: '24px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '12px',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: 'var(--text-secondary)',
          }}
        >
          <span>Прогресс</span>
          <span>
            {answered} из {totalQuestions}
          </span>
        </div>
        <div
          role="progressbar"
          aria-valuenow={progressPercent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Прогресс теста"
          style={{
            marginTop: '8px',
            height: '4px',
            background: 'var(--bg-surface)',
            borderRadius: '2px',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progressPercent}%`,
              height: '100%',
              background: 'var(--accent)',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* «Повторить ошибки» — resumed from the regular stream's wrong answers */}
      {wrongQuestionIds.length > 0 && (
        <button
          type="button"
          onClick={() => startReviewQuiz(wrongQuestionIds)}
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            marginTop: 'var(--space-4)',
            background: 'rgba(244, 67, 54, 0.1)',
            border: '1px solid var(--danger)',
            borderRadius: 'var(--radius-md)',
            color: 'var(--text-primary)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            textAlign: 'left',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>Повторить ошибки</span>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--danger)',
              fontWeight: 600,
            }}
          >
            {wrongQuestionIds.length} вопр.
          </span>
        </button>
      )}

      {/* RHCSA Roadmap - informational only, topics are NOT interactive */}
      <div style={{ marginTop: 'var(--space-6)' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            marginBottom: 'var(--space-3)',
          }}
        >
          <span
            style={{
              fontSize: 'var(--text-xs)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--letter-wide, 0.5px)',
              color: 'var(--text-secondary)',
              fontWeight: 600,
            }}
          >
            Программа RHCSA
          </span>
          <span
            style={{
              fontSize: 'var(--text-xs)',
              color: 'var(--text-secondary)',
            }}
          >
            {`${AVAILABLE_TOPICS.length} из ${TOPICS.length} тем`}
          </span>
        </div>

        {TOPICS.map((topic) => {
          const count = getTopicCount(topic.key);
          const isAvailable = topic.status === 'available';
          const Icon = topic.Icon;

          const rowStyle = {
            display: 'flex' as const,
            alignItems: 'center' as const,
            gap: 'var(--space-3)',
            padding: 'var(--space-3)',
            marginBottom: 'var(--space-2)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            opacity: isAvailable ? 1 : 0.55,
            width: '100%' as const,
            textAlign: 'left' as const,
            fontFamily: 'inherit',
            color: 'inherit',
          };

          const inner = (
            <>
              <Icon
                size={20}
                color={isAvailable ? 'var(--accent)' : 'var(--text-secondary)'}
                aria-hidden="true"
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                  }}
                >
                  {topic.title}
                </div>
                <div
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-secondary)',
                    marginTop: 'var(--space-1)',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {topic.description}
                </div>
              </div>
              {isAvailable ? (
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: 'var(--accent)',
                    flexShrink: 0,
                  }}
                >
                  {count} вопр.
                </span>
              ) : (
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                    flexShrink: 0,
                    textTransform: 'uppercase',
                    letterSpacing: 'var(--letter-wide, 0.5px)',
                  }}
                >
                  Скоро
                </span>
              )}
            </>
          );

          if (isAvailable) {
            return (
              <button
                key={topic.key}
                type="button"
                onClick={() => startTopicQuiz(topic.key)}
                aria-label={`Начать тему: ${topic.title}`}
                style={{ ...rowStyle, cursor: 'pointer' }}
              >
                {inner}
              </button>
            );
          }

          return (
            <div key={topic.key} style={rowStyle}>
              {inner}
            </div>
          );
        })}
      </div>
      {/* Exam banner REPLACES the resume banner while an exam runs */}
      {examActive ? (
        <div
          style={{
            padding: 'var(--space-3)',
            background: 'rgba(33,150,243,0.1)',
            border: '1px solid var(--accent)',
            borderRadius: 'var(--radius-md)',
            marginTop: 'var(--space-4)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <div>
            <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>Экзамен идёт</div>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                marginTop: 2,
              }}
            >
              {`${timerDisplay} осталось`}
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigateTo('question')}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Продолжить
          </button>
        </div>
      ) : isQuizInProgress && !reviewQuestionIds ? (
        /* Resume banner - unfinished regular quiz only */
        <div
          style={{
            padding: 'var(--space-3)',
            background: 'var(--bg-surface)',
            borderRadius: 'var(--radius-md)',
            marginTop: 'var(--space-4)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <div>
            <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>Тест не завершён</div>
            <div
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                marginTop: 2,
              }}
            >
              {`Вопрос ${currentIndex + 1} из ${totalQuestions}`}
            </div>
          </div>
          <button
            type="button"
            onClick={resumeQuiz}
            style={{
              padding: 'var(--space-2) var(--space-3)',
              background: 'var(--accent)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-sm)',
              fontSize: 'var(--text-xs)',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Продолжить
          </button>
        </div>
      ) : null}

      {/* Exam entry point - only when no exam is running */}
      {!examActive && (
        <button
          type="button"
          onClick={() => startExam(20, 30 * 60 * 1000)}
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            background: 'transparent',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-strong)',
            borderRadius: 'var(--radius-md)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            cursor: 'pointer',
            marginTop: 'var(--space-2)',
            fontFamily: 'inherit',
          }}
        >
          Режим экзамена (20 вопросов, 30 минут)
        </button>
      )}

      {!examActive && !isTelegram && (
        <button
          type="button"
          onClick={() => {
            if (reviewQuestionIds) {
              startRegularQuiz();
            }
            navigateTo('question');
          }}
          style={{
            background: 'var(--accent)',
            color: 'var(--text-primary)',
            padding: SPACING.md,
            borderRadius: LAYOUT.buttonRadius,
            width: '100%',
            cursor: 'pointer',
            fontSize: 16,
            fontWeight: 600,
            border: 'none',
            marginTop: SPACING.xl,
            fontFamily: 'inherit',
          }}
        >
          Продолжить
        </button>
      )}

{/* Legal disclaimer — trademark safety (independent trainer notice) */}
      <div
        data-disclaimer="legal"
        style={{
          marginTop: 'var(--space-6)',
          paddingTop: 'var(--space-3)',
          borderTop: '1px solid var(--border-subtle)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)',
          lineHeight: 1.5,
        }}
      >
        LinuxExam — независимый тренажёр. Не аффилирован с Red Hat, Inc. и CompTIA.
        RHCSA® — торговая марка Red Hat, Inc. CompTIA® и Linux+® — торговые марки CompTIA.
        Вопросы оригинальные, основаны на публично доступных exam objectives.
      </div>
</ScreenContainer>
  );
}
