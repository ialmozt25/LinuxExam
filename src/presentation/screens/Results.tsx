import { isTMA } from '@telegram-apps/sdk-react';
import { useQuizStore } from '@/store/quizStore';
import { shareResult } from '@/platform/telegram_adapter';
import { COLORS, SPACING, LAYOUT } from '@/presentation/theme';
import { pluralizeQuestions } from '@/utils/pluralize';

export default function Results() {
  const answers = useQuizStore((s) => s.answers);
  const questions = useQuizStore((s) => s.questions);
  const navigateTo = useQuizStore((s) => s.navigateTo);
  const resetProgress = useQuizStore((s) => s.resetProgress);

  const isTelegram = isTMA();
  const shareUrl =
    typeof window !== 'undefined' && window.location.origin
      ? window.location.origin + window.location.pathname
      : 'https://ialmozt25.github.io/LinuxExam/';

  const totalQuestions = questions.length;
  const answered = answers.length;
  const correct = answers.filter((a) => a.isCorrect).length;
  const accuracy = answered > 0 ? Math.round((correct / answered) * 100) : 0;
  const hasAnyAnswers = answered > 0;

  const TOPICS = [
    { key: 'file_permissions' as const, title: 'Права доступа' },
    { key: 'file_management' as const, title: 'Управление файлами' },
    { key: 'process_management' as const, title: 'Управление процессами' },
  ];

  const topicStats = TOPICS.map((topic) => {
    const topicQuestions = questions.filter((q) => q.topic === topic.key);
    const topicIds = new Set(topicQuestions.map((q) => q.id));
    const topicAnswers = answers.filter((a) => topicIds.has(a.questionId));
    const topicCorrect = topicAnswers.filter((a) => a.isCorrect).length;
    return {
      key: topic.key,
      title: topic.title,
      correct: topicCorrect,
      total: topicQuestions.length,
    };
  });

  const handleRetry = () => {
    resetProgress();
    navigateTo('question');
  };

  const handleBackToTopics = () => {
    navigateTo('dashboard');
  };

  return (
    <div
      style={{
        minHeight: '100dvh',
        background: COLORS.background,
        color: COLORS.textPrimary,
        paddingTop: SPACING.md,
        paddingLeft: SPACING.md,
        paddingRight: SPACING.md,
        paddingBottom: 'calc(80px + env(safe-area-inset-bottom, 0px))',
        maxWidth: LAYOUT.containerMaxWidth,
        margin: '0 auto',
      }}
    >
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
        Результаты
      </h1>

      {/* Big score card */}
      <div
        style={{
          background: COLORS.surface,
          padding: SPACING.lg,
          borderRadius: LAYOUT.cardRadius,
          textAlign: 'center',
          marginTop: SPACING.lg,
        }}
      >
        {!hasAnyAnswers ? (
          <div style={{ fontSize: 16, color: COLORS.textSecondary, padding: SPACING.lg }}>
            Вы ещё не ответили ни на один вопрос
          </div>
        ) : (
          <>
            <div style={{ fontSize: 48, fontWeight: 700, color: COLORS.primary }}>
              {`${correct} / ${answered}`}
            </div>
            <div style={{ fontSize: 14, color: COLORS.textSecondary, marginTop: SPACING.sm }}>
              {`Правильных из ${answered} ${pluralizeQuestions(answered)}`}
            </div>
            {answered < totalQuestions && (
              <div
                style={{
                  fontSize: 12,
                  color: COLORS.textSecondary,
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
                  accuracy >= 70 ? COLORS.correct : accuracy >= 40 ? COLORS.primary : COLORS.wrong,
              }}
            >
              {`${accuracy}%`}
            </div>
          </>
        )}
      </div>

      {/* Per-topic breakdown */}
      <div style={{ marginTop: SPACING.xl }}>
        <h2
          style={{
            fontSize: 14,
            color: COLORS.textSecondary,
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
              background: COLORS.surface,
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
              <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: SPACING.xs }}>
                {`${topicStat.total} ${pluralizeQuestions(topicStat.total)}`}
              </div>
            </div>
            <div
              style={{
                fontSize: 16,
                fontWeight: 600,
                color:
                  topicStat.correct === topicStat.total
                    ? COLORS.correct
                    : topicStat.correct === 0
                      ? COLORS.wrong
                      : COLORS.textPrimary,
              }}
            >
              {`${topicStat.correct}/${topicStat.total}`}
            </div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ marginTop: SPACING.xl }}>
        <button
          type="button"
          onClick={handleRetry}
          style={{
            width: '100%',
            padding: SPACING.md,
            background: COLORS.primary,
            color: COLORS.textPrimary,
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
          onClick={handleBackToTopics}
          style={{
            width: '100%',
            padding: SPACING.md,
            background: COLORS.surface,
            color: COLORS.textPrimary,
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
              const text = `Прошёл ${correct}/${answered} в Тренажёре RHCSA (${accuracy}%)`;
              shareResult(shareUrl, text);
            }}
            style={{
              width: '100%',
              padding: SPACING.md,
              background: COLORS.surface,
              color: COLORS.textPrimary,
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
    </div>
  );
}
