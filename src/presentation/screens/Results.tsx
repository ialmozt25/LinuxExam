import { useEffect, useMemo } from 'react';
import { isTMA } from '@telegram-apps/sdk-react';
import { useQuizStore } from '@/store/quizStore';
import { shareResult } from '@/platform/telegram_adapter';
import { SPACING, LAYOUT } from '@/presentation/theme';
import { SESSION_LIMIT } from '@/domain/fsrs';
import { pluralizeQuestions } from '@/utils/pluralize';
import { ScreenContainer } from '@/presentation/components/ScreenContainer';
import { AppHeader } from '@/presentation/components/AppHeader';
import { TOPICS } from '@/data/topics';

export default function Results() {
  const regularAnswers = useQuizStore((s) => s.answers);
  const reviewAnswers = useQuizStore((s) => s.reviewAnswers);
  const activeTopic = useQuizStore((s) => s.activeTopic);
  const questions = useQuizStore((s) => s.questions);
  const navigateTo = useQuizStore((s) => s.navigateTo);
  const resetProgress = useQuizStore((s) => s.resetProgress);
  const wrongQuestionIds = useQuizStore((s) => s.wrongQuestionIds);
  const startReviewQuiz = useQuizStore((s) => s.startReviewQuiz);
  const reviewQuestionIds = useQuizStore((s) => s.reviewQuestionIds);
  const isReview = reviewQuestionIds !== null;
  const scheduledReviews = useQuizStore((s) => s.scheduledReviews);
  const getSessionIds = useQuizStore((s) => s.getSessionIds);

  const isTelegram = isTMA();

  // Reset scroll when the results screen mounts.
  useEffect(() => {
    const el =
      document.getElementById('root') ?? document.scrollingElement ?? document.documentElement;
    el.scrollTop = 0;
  }, []);

  const shareUrl =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin + window.location.pathname
      : 'https://ialmozt25.github.io/LinuxExam/';

  // Exactly one answer stream is active: review (a review or topic quiz) or the
  // regular one. Review is keyed off reviewQuestionIds, NOT off
  // reviewAnswers.length - the latter is merely a stale leftover after a review
  // run and would misreport a regular run as a review one.
  // spec 068: the legacy inline-exam summary branch used to sit in front of this
  // and win over both; the exam now has its own screen (ExamResults.tsx).
  const answers = isReview ? reviewAnswers : regularAnswers;

  const totalQuestions = questions.length;
  const answered = answers.length;
  const correct = answers.filter((a) => a.isCorrect).length;
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
  const hasAnyAnswers = answered > 0;

  // A review is either a topic quiz (activeTopic set) or "Повторить ошибки".
  const topicTitle = activeTopic ? (TOPICS.find((t) => t.key === activeTopic)?.title ?? null) : null;
  const screenTitle =
    isReview && topicTitle ? `Тема: ${topicTitle}` : isReview ? 'Результаты повторения' : 'Результаты';

  const topicStats = TOPICS.map((topic) => {
    const topicQuestions = questions.filter((q) => q.topic === topic.key);
    const topicIds = new Set(topicQuestions.map((q) => q.id));
    // Counted against the ACTIVE stream, so a review/topic run does not report
    // every topic as 0/12 while its own score reads 2/2.
    const topicAnswers = answers.filter((a) => topicIds.has(a.questionId));
    const topicCorrect = topicAnswers.filter((a) => a.isCorrect).length;
    return {
      key: topic.key,
      title: topic.title,
      correct: topicCorrect,
      total: topicQuestions.length,
      // Share of THIS topic's questions answered correctly so far.
      percent: topicQuestions.length > 0 ? Math.round((topicCorrect / topicQuestions.length) * 100) : 0,
    };
  });

  // Regular stream only (the button is not rendered for a review): clears the
  // per-run progress and starts the run from the top.
  const handleRetry = () => {
    resetProgress();
    navigateTo('question');
  };

  const handleBackToTopics = () => {
    navigateTo('dashboard');
  };

  /**
   * «Ещё 30» (spec 065). Во время прогона «сегодня» каждый ответ сдвигает `next`
   * в будущее, поэтому `getSessionIds()` возвращает уже только то, что осталось:
   * это и есть материал следующей сессии. Прогон открывается тем же
   * `kind='today'`, что и вход с Dashboard, — иначе ответы не пересчитывали бы
   * расписание. Кнопка появляется только когда есть что открывать.
   */
  const nextBatch = useMemo(() => getSessionIds(SESSION_LIMIT), [getSessionIds, scheduledReviews]);
  const seenIds = useMemo(
    () => new Set([...(reviewQuestionIds ?? []), ...answers.map((a) => a.questionId)]),
    [reviewQuestionIds, answers],
  );
  const nextBatchIds = useMemo(
    () => nextBatch.filter((id) => !seenIds.has(id)),
    [nextBatch, seenIds],
  );
  // Остаток показываем только в review-прогоне: в регулярном потоке «Ещё N»
  // конкурировал бы с «Пройти заново» и с «Повторить ошибки».
  const showNextBatch = isReview && nextBatchIds.length > 0;

  const handleNextBatch = () => {
    const ids = getSessionIds(SESSION_LIMIT);
    if (ids.length === 0) return;
    startReviewQuiz(ids, 'today');
    navigateTo('question');
  };

  return (
    <ScreenContainer data-testid="results-screen">
      <AppHeader onHome={handleBackToTopics} center={screenTitle} />

      {/* Header */}
      <h1
        style={{
          fontSize: 'var(--heading-1)',
          fontWeight: 700,
          margin: 0,
          marginBottom: SPACING.sm,
          textAlign: 'center',
        }}
      >
        {screenTitle}
      </h1>

      {/* Big score card */}
      <div
        style={{
          background: 'var(--bg-surface)',
          padding: SPACING.lg,
          borderRadius: LAYOUT.cardRadius,
          textAlign: 'center',
          marginTop: SPACING.lg,
        }}
      >
        {!hasAnyAnswers ? (
          <div
            data-testid="results-empty"
            style={{ fontSize: 'var(--body)', color: 'var(--text-secondary)', padding: SPACING.lg }}
          >
            Вы ещё не ответили ни на один вопрос
          </div>
        ) : correct === 0 ? (
          /* Ноль правильных — не «провал», а первый шаг (spec 065, К5.3).
             Вместо «0 / N, 0 %» показывается поддержка и следующий шаг: голый
             ноль без действия не подсказывает, что делать дальше. */
          <div data-testid="results-zero" style={{ padding: SPACING.lg }}>
            <div
              style={{
                fontSize: 'var(--heading-2)',
                fontWeight: 700,
                color: 'var(--text-primary)',
              }}
            >
              Первый шаг сделан
            </div>
            <div
              style={{
                fontSize: 'var(--body)',
                lineHeight: 'var(--body-line-height)',
                color: 'var(--text-secondary)',
                marginTop: SPACING.sm,
              }}
            >
              {`Отвечено ${answered} ${pluralizeQuestions(answered)}, верных пока нет. Разбор — в объяснении каждого вопроса.`}
            </div>
            <button
              type="button"
              data-testid="results-zero-retry"
              onClick={handleRetry}
              style={{
                marginTop: SPACING.md,
                padding: `${SPACING.sm} ${SPACING.md}`,
                background: 'var(--btn-primary-bg)',
                color: 'var(--btn-primary-text)',
                border: 'none',
                borderRadius: 'var(--btn-primary-radius)',
                fontSize: 'var(--text-sm)',
                fontWeight: 600,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Попробовать снова
            </button>
          </div>
        ) : (
          <>
            <div
              data-testid="results-score"
              style={{ fontSize: 'var(--heading-2xl)', fontWeight: 700, color: 'var(--accent)' }}
            >
              {`${correct} / ${answered}`}
            </div>
            <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: SPACING.sm }}>
              {`Правильных из ${answered} ${pluralizeQuestions(answered)}`}
            </div>
            {answered < totalQuestions && (
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-secondary)',
                  marginTop: SPACING.xs,
                  opacity: 0.7,
                }}
              >
                {`Всего в базе: ${totalQuestions} ${pluralizeQuestions(totalQuestions)}`}
              </div>
            )}
            <div
              data-testid="results-accuracy"
              style={{
                fontSize: 'var(--heading-2)',
                fontWeight: 600,
                marginTop: SPACING.md,
                color:
                  accuracy >= 70 ? 'var(--success)' : accuracy >= 40 ? 'var(--accent)' : 'var(--danger)',
              }}
            >
              {`${accuracy}%`}
            </div>
          </>
        )}
      </div>

      {/* «Ещё 30» (spec 065): остаток пула повторения. Кнопка «Пройти заново» на
          это не годится — она перезапускает ТОТ ЖЕ список, а здесь открывается
          следующая сессия (до SESSION_LIMIT непройденных). */}
      {showNextBatch && (
        <button
          type="button"
          data-testid="review-next-batch"
          onClick={handleNextBatch}
          style={{
            width: '100%',
            padding: SPACING.md,
            background: 'var(--accent)',
            color: 'var(--btn-primary-text)',
            border: 'none',
            borderRadius: 'var(--btn-primary-radius)',
            fontSize: 'var(--body)',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            marginTop: SPACING.lg,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <span>{`Ещё ${SESSION_LIMIT}`}</span>
          <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>{`${nextBatchIds.length} вопр.`}</span>
        </button>
      )}

      {/* Review the questions answered incorrectly in the regular stream. Only
          offered in the regular stream: inside a review the list is already the
          subject matter, and a second entry point would restart it. */}
      {!isReview && wrongQuestionIds.length > 0 && (
        <button
          type="button"
          data-testid="results-review-wrong"
          onClick={() => startReviewQuiz(wrongQuestionIds)}
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--btn-secondary-radius)',
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            marginTop: 'var(--space-4)',
            marginBottom: 'var(--space-2)',
          }}
        >
          {`Повторить ошибки (${wrongQuestionIds.length})`}
        </button>
      )}

      {/* Per-topic breakdown */}
      <div data-testid="results-topics" style={{ marginTop: SPACING.xl }}>
        <h2
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--letter-wide)',
            fontWeight: 600,
            margin: 0,
            marginBottom: SPACING.md,
          }}
        >
          По темам
        </h2>
        {topicStats.map((topicStat) => (
          <div
            key={topicStat.key}
            data-testid={`results-topic-${topicStat.key}`}
            style={{
              background: 'var(--bg-surface)',
              padding: SPACING.md,
              borderRadius: LAYOUT.cardRadius,
              marginBottom: SPACING.sm,
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>{topicStat.title}</div>
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: SPACING.xs }}>
                {`${topicStat.total} ${pluralizeQuestions(topicStat.total)}`}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  fontSize: 'var(--body)',
                  fontWeight: 600,
                  color:
                    topicStat.correct === topicStat.total
                      ? 'var(--success)'
                      : topicStat.correct === 0
                        ? 'var(--danger)'
                        : 'var(--text-primary)',
                }}
              >
                {`${topicStat.correct}/${topicStat.total}`}
              </div>
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  fontWeight: 600,
                  marginTop: SPACING.xs,
                  color:
                    topicStat.percent >= 70
                      ? 'var(--success)'
                      : topicStat.percent >= 40
                        ? 'var(--accent)'
                        : 'var(--danger)',
                }}
              >
                {`${topicStat.percent}%`}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ marginTop: SPACING.xl }}>
        {!isReview && (
        <button
          type="button"
          data-testid="results-retry"
          onClick={handleRetry}
          style={{
            width: '100%',
            padding: SPACING.md,
            background: 'var(--accent)',
            color: 'var(--btn-primary-text)',
            border: 'none',
            borderRadius: 'var(--btn-primary-radius)',
            fontSize: 'var(--body)',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            marginBottom: SPACING.sm,
          }}
        >
          Пройти заново
        </button>
        )}
        <button
          type="button"
          data-testid="results-back"
          onClick={handleBackToTopics}
          style={{
            width: '100%',
            padding: SPACING.md,
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: LAYOUT.buttonRadius,
            fontSize: 'var(--body)',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          К темам
        </button>

        {isTelegram && correct > 0 && answered > 0 && (
          <button
            type="button"
            data-testid="results-share"
            onClick={() => {
              const text = `Прошёл ${correct}/${answered} в LinuxExam (${accuracy}%)`;
              shareResult(shareUrl, text);
            }}
            style={{
              width: '100%',
              padding: SPACING.md,
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: LAYOUT.buttonRadius,
              fontSize: 'var(--body)',
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              marginTop: SPACING.sm,
            }}
          >
            Поделиться результатом
          </button>
        )}
        {/* TODO(content): заменить «Пройти заново» на «Повторить ошибки» с фильтрацией неправильных ответов когда база вопросов ≥ 50 */}
      </div>
    </ScreenContainer>
  );
}
