import { useEffect } from 'react';
import { isTMA } from '@telegram-apps/sdk-react';
import { useQuizStore } from '@/store/quizStore';
import { shareResult } from '@/platform/telegram_adapter';
import { SPACING, LAYOUT } from '@/presentation/theme';
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
  const examLastResult = useQuizStore((s) => s.examLastResult);
  const startExam = useQuizStore((s) => s.startExam);
  const cancelExam = useQuizStore((s) => s.cancelExam);

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

  // Exactly one answer stream is active, resolved with the same precedence as
  // Question.tsx: exam > review (a review or topic quiz) > regular. Review is
  // keyed off reviewQuestionIds, NOT off reviewAnswers.length - the latter is
  // merely a stale leftover after a review run and would misreport a regular
  // run as a review one.
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

  // ---- Exam summary takes over the whole screen when a finished exam exists ----
  if (examLastResult !== null) {
    const { answers: examAns, startedAt, finishedAt } = examLastResult;
    const examCorrect = examAns.filter((a) => a.isCorrect).length;
    const examAnswered = examAns.length;
    const examAccuracy = examAnswered > 0 ? Math.round((examCorrect / examAnswered) * 100) : 0;
    const timeSpentMs = finishedAt - startedAt;
    const timeMm = Math.floor(timeSpentMs / 60000);
    const timeSs = Math.floor((timeSpentMs % 60000) / 1000);

    return (
      <ScreenContainer>
        <AppHeader onHome={() => navigateTo('dashboard')} center="Экзамен" />

        <h1
          style={{
            fontSize: 24,
            fontWeight: 700,
            margin: 0,
            marginBottom: SPACING.sm,
            textAlign: 'center',
          }}
        >
          Экзамен завершён
        </h1>

        <div
          style={{
            background: 'var(--bg-surface)',
            padding: SPACING.lg,
            borderRadius: LAYOUT.cardRadius,
            textAlign: 'center',
            marginTop: SPACING.lg,
          }}
        >
          <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--accent)' }}>
            {examCorrect + ' / ' + examAnswered}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: SPACING.sm }}>
            Правильных ответов
          </div>
          <div
            style={{
              fontSize: 20,
              fontWeight: 600,
              marginTop: SPACING.md,
              color:
                examAccuracy >= 70
                  ? 'var(--success)'
                  : examAccuracy >= 40
                    ? 'var(--accent)'
                    : 'var(--danger)',
            }}
          >
            {examAccuracy + '%'}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: SPACING.md }}>
            {`Время: ${timeMm}:${String(timeSs).padStart(2, '0')}`}
          </div>
        </div>

        <div style={{ marginTop: SPACING.xl }}>
          <button
            type="button"
            onClick={() => startExam(20, 30 * 60 * 1000)}
            style={{
              width: '100%',
              padding: SPACING.md,
              background: 'var(--accent)',
              color: 'var(--text-primary)',
              border: 'none',
              borderRadius: LAYOUT.buttonRadius,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
              marginBottom: SPACING.sm,
            }}
          >
            Пройти заново
          </button>
          <button
            type="button"
            onClick={() => cancelExam()}
            style={{
              width: '100%',
              padding: SPACING.md,
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              border: 'none',
              borderRadius: LAYOUT.buttonRadius,
              fontSize: 16,
              fontWeight: 600,
              cursor: 'pointer',
              fontFamily: 'inherit',
            }}
          >
            Выйти
          </button>
        </div>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <AppHeader onHome={handleBackToTopics} center={screenTitle} />

      {/* Header */}
      <h1
        style={{
          fontSize: 24,
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
          <div style={{ fontSize: 16, color: 'var(--text-secondary)', padding: SPACING.lg }}>
            Вы ещё не ответили ни на один вопрос
          </div>
        ) : (
          <>
            <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--accent)' }}>
              {`${correct} / ${answered}`}
            </div>
            <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: SPACING.sm }}>
              {`Правильных из ${answered} ${pluralizeQuestions(answered)}`}
            </div>
            {answered < totalQuestions && (
              <div
                style={{
                  fontSize: 12,
                  color: 'var(--text-secondary)',
                  marginTop: SPACING.xs,
                  opacity: 0.7,
                }}
              >
                {`Всего в базе: ${totalQuestions} ${pluralizeQuestions(totalQuestions)}`}
              </div>
            )}
            <div
              style={{
                fontSize: 20,
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

      {/* Review the questions answered incorrectly in the regular stream. Only
          offered in the regular stream: inside a review the list is already the
          subject matter, and a second entry point would restart it. */}
      {!isReview && wrongQuestionIds.length > 0 && (
        <button
          type="button"
          onClick={() => startReviewQuiz(wrongQuestionIds)}
          style={{
            width: '100%',
            padding: 'var(--space-3)',
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
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
      <div style={{ marginTop: SPACING.xl }}>
        <h2
          style={{
            fontSize: 14,
            color: 'var(--text-secondary)',
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
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
              <div style={{ fontSize: 14, fontWeight: 600 }}>{topicStat.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: SPACING.xs }}>
                {`${topicStat.total} ${pluralizeQuestions(topicStat.total)}`}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  fontSize: 16,
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
                  fontSize: 12,
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
          onClick={handleRetry}
          style={{
            width: '100%',
            padding: SPACING.md,
            background: 'var(--accent)',
            color: 'var(--text-primary)',
            border: 'none',
            borderRadius: LAYOUT.buttonRadius,
            fontSize: 16,
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
          onClick={handleBackToTopics}
          style={{
            width: '100%',
            padding: SPACING.md,
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            border: 'none',
            borderRadius: LAYOUT.buttonRadius,
            fontSize: 16,
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
            onClick={() => {
              const text = `Прошёл ${correct}/${answered} в LinuxExam (${accuracy}%)`;
              shareResult(shareUrl, text);
            }}
            style={{
              width: '100%',
              padding: SPACING.md,
              background: 'var(--bg-surface)',
              color: 'var(--text-primary)',
              border: 'none',
              borderRadius: LAYOUT.buttonRadius,
              fontSize: 16,
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
