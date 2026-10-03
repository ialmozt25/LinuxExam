import { useEffect, useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Flame, MoonStar, Sun } from 'lucide-react';
import { useQuizStore } from '@/store/quizStore';
import { SPACING, LAYOUT } from '@/presentation/theme';
import { isTMA } from '@telegram-apps/sdk-react';
import { useTelegramMainButton } from '@/hooks/useTelegramMainButton';
import { ScreenContainer } from '@/presentation/components/ScreenContainer';
import { StreakBadge } from '@/presentation/components/StreakBadge';
import { XpBar } from '@/presentation/components/XpBar';
import { DailyGoalPicker } from '@/presentation/components/DailyGoalPicker';
import { useDailyGoalProgress } from '@/store/dailyGoal';
import { useExamTimer } from '@/hooks/useExamTimer';
import { useCanAccessTopic } from '@/store/paywall';
import { isFreeTopic } from '@/domain/paywall';
import { TOPICS, AVAILABLE_TOPICS } from '@/data/topics';
import { getBankTotal, getTopicCount } from '@/data/questions';
import type { ResolvedTheme } from '@/utils/theme';

interface Props {
  /** Theme currently in effect, owned by useThemeController in App. */
  theme: ResolvedTheme;
  /** Flips the theme, or returns to inherit when it matches the system one. */
  onToggleTheme: () => void;
}

/** Есть ли у пользователя доступ к теме целиком (spec 063). */
type TopicGate = (key: string) => boolean;

/**
 * Клик по теме (spec 063). Доступ есть — открывается существующий прогон
 * (`startTopicQuiz`); доступа нет (платная тема, `!isPro`, trial неактивен) —
 * поднимается контентный paywall. Логика Free-тем не меняется: они всегда
 * проходят по первой ветке.
 */
function openTopic(key: string, hasAccess: boolean) {
  const store = useQuizStore.getState();
  if (!hasAccess) {
    store.showPaywall();
    return;
  }
  store.startTopicQuiz(key);
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
  const wrongQuestionIds = useQuizStore((s) => s.wrongQuestionIds);
  const startReviewQuiz = useQuizStore((s) => s.startReviewQuiz);

  // Paywall (spec 063). Один хук на компонент: он подписан на `isPro` и
  // `trialStartedAt`, а сам ответ про конкретную тему считает чистая функция
  // домена (`canAccessTopic`), поэтому 14 тем не подписывают компонент 14 раз.
  const paywallAccess: TopicGate = useCanAccessTopic;

  // FSRS-lite (spec 052): нагрузка для кнопки «Повторить сегодня (N)».
  // Банк отдаёт store асинхронно (per-topic chunks), поэтому N пересчитывается
  // на каждый его приход — до загрузки банка review-today просто не показывается.
  const bankIds = useQuizStore(useShallow((s) => s.questions.map((question) => question.id)));
  const scheduledReviews = useQuizStore((s) => s.scheduledReviews);
  const ensureReviewsInitialized = useQuizStore((s) => s.ensureReviewsInitialized);
  const getTodayReviewIds = useQuizStore((s) => s.getTodayReviewIds);

  const reviewIds = useMemo(
    () => getTodayReviewIds(),
    [getTodayReviewIds, scheduledReviews, bankIds],
  );
  const N = reviewIds.length;

  // Реестр расписания до-наполняется «пора сейчас» ровно один раз на банк:
  // экшен идемпотентен и возвращает тот же объект, когда заполнять нечего.
  useEffect(() => {
    ensureReviewsInitialized(bankIds);
  }, [ensureReviewsInitialized, bankIds]);

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

  // Retention (spec 061): дневная цель уже посчитана селектором вне стора.
  const daily = useDailyGoalProgress();


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
            data-testid="theme-toggle"
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
          data-testid="dashboard-subtitle"
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

      {/* Retention-зона (spec 061): streak badge + XP bar с дневной целью рядом.
          Существующие блоки ниже не тронуты — зона только добавлена. */}
      <div
        id="dashboard-retention"
        data-testid="dashboard-retention"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-3)',
          marginTop: '24px',
        }}
      >
        <StreakBadge />
        <XpBar />
      </div>
      <div
        data-testid="retention-goal-line"
        style={{
          marginTop: 'var(--space-2)',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
        }}
      >
        {`Цель: ${daily.todayXp} / ${daily.goalXp} XP`}
      </div>

      {/* Progress */}
      <div id="dashboard-progress" data-testid="dashboard-progress" style={{ marginTop: '24px' }}>
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

      {/* «Повторить сегодня (N)» — FSRS-lite (spec 052). Скрыта при N = 0.
          Прогон идёт review-стримом, поэтому бесплатный лимит не расходуется. */}
      {N > 0 && (
        <button
          type="button"
          data-testid="review-today"
          onClick={() => startReviewQuiz(reviewIds, 'today')}
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            marginTop: 'var(--space-4)',
            background: 'var(--accent)',
            border: 'none',
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
          <span>{`Повторить сегодня (${N})`}</span>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>
            {`${N} вопр.`}
          </span>
        </button>
      )}

      {/* Exam mode (spec 054): отдельный поток из трёх экранов (настройка →
          прогон → итоги) с пресетами 30/60/90 и разбором по темам. Историческая
          кнопка «Режим экзамена (20 вопросов, 30 минут)» ниже оставлена как есть:
          на неё опираются существующие e2e-спеки. */}
      <button
        type="button"
        data-testid="exam-mode"
        onClick={() => navigateTo('exam-setup')}
        style={{
          width: '100%',
          padding: 'var(--space-3)',
          marginTop: 'var(--space-4)',
          background: 'transparent',
          color: 'var(--text-primary)',
          border: '1px solid var(--accent)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        📝 Exam mode — 30/60/90 вопросов с разбором
      </button>

      {/* Analytics (spec 058): «персональный тренер» — radar по 14 темам,
          готовность, слабые зоны и тренд за 7 дней. Данные уже в persist
          (questionStats), поэтому экран ничего не дозагружает. */}
      <button
        type="button"
        data-testid="analytics-mode"
        onClick={() => navigateTo('analytics')}
        style={{
          width: '100%',
          padding: 'var(--space-3)',
          marginTop: 'var(--space-4)',
          background: 'transparent',
          color: 'var(--text-primary)',
          border: '1px solid var(--accent)',
          borderRadius: 'var(--radius-md)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          cursor: 'pointer',
          textAlign: 'left',
          fontFamily: 'inherit',
        }}
      >
        📊 Аналитика — готовность, слабые темы, тренд
      </button>

      {/* «Повторить ошибки» — resumed from the regular stream's wrong answers */}
      {wrongQuestionIds.length > 0 && (
        <button
          type="button"
          data-testid="review-wrong"
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
          // spec 063: Free-темы открыты всем, Paid-темы — только Pro или активным
          // trial-ом. Тема со статусом «Скоро» остаётся неинтерактивной: доступ
          // для неё не считается, бейджа нет.
          const isFree = isFreeTopic(topic.key);
          const allowed = !isAvailable || paywallAccess(topic.key);
          const badge = !isAvailable
            ? null
            : isFree || allowed
              ? { testid: 'paywall-badge-free', label: 'Бесплатно' }
              : { testid: 'paywall-badge-pro', label: 'PRO' };

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
              {badge !== null && (
                <span
                  data-testid={badge.testid}
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    color: isFree ? 'var(--text-secondary)' : 'var(--accent)',
                    background: 'var(--bg-elevated)',
                    border: '1px solid var(--border-subtle)',
                    padding: '2px 6px',
                    borderRadius: 'var(--radius-sm)',
                    flexShrink: 0,
                    textTransform: 'uppercase',
                    letterSpacing: 'var(--letter-wide, 0.5px)',
                  }}
                >
                  {badge.label}
                </span>
              )}
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
                data-testid={`topic-${topic.key}`}
                onClick={() => openTopic(topic.key, allowed)}
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
          data-testid="exam-banner"
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
              data-testid="exam-timer"
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
            data-testid="exam-continue"
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
          data-testid="resume-banner"
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
              data-testid="resume-position"
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
            data-testid="resume-button"
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
          data-testid="start-exam"
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
          data-testid="dashboard-continue"
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

      {/* Показывается ровно один раз: после онбординга и до подтверждения цели. */}
      <DailyGoalPicker />
</ScreenContainer>
  );
}
