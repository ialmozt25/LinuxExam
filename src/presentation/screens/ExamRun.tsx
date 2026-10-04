import { useEffect, useState } from 'react';
import { useQuizStore } from '@/store/quizStore';
import { ScreenContainer } from '@/presentation/components/ScreenContainer';
import { SPACING } from '@/presentation/theme';
import { formatRemaining } from '@/domain/exam';

/**
 * Exam mode (spec 054) — экран прогона.
 *
 * Отдаёт вопрос за вопросом без обратной связи и объяснений (как и исторический
 * инлайн-экзамен): ответ уходит в store, переход — только по кнопке «Ответить».
 * Таймер считается от wall-clock старта, поэтому переживает троттлинг вкладки;
 * на нуле прогон завершается причиной 'timeout'.
 */
export default function ExamRun() {
  const status = useQuizStore((s) => s.examSession.status);
  const answersCount = useQuizStore((s) => s.examSession.answers.length);
  const totalQuestions = useQuizStore((s) => s.examSession.questionIds.length);
  const startedAt = useQuizStore((s) => s.examSession.startedAt);
  const durationMs = useQuizStore((s) => s.examSession.durationMs);
  const getExamCurrentQuestionId = useQuizStore((s) => s.getExamCurrentQuestionId);
  const getExamRemainingMs = useQuizStore((s) => s.getExamRemainingMs);
  const submitExamAnswer = useQuizStore((s) => s.submitExamAnswer);
  const nextExamQuestion = useQuizStore((s) => s.nextExamQuestion);
  const finishExamSession = useQuizStore((s) => s.finishExamSession);
  const cancelExamSession = useQuizStore((s) => s.cancelExamSession);
  const questions = useQuizStore((s) => s.questions);

  // Выбранный вариант — локальный: в store ответ уходит только по «Ответить»,
  // поэтому прогон остаётся «без обратной связи» до самого нажатия.
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [remaining, setRemaining] = useState(() => getExamRemainingMs(Date.now()));

  const currentId = getExamCurrentQuestionId();
  const question = currentId ? questions.find((q) => q.id === currentId) ?? null : null;

  // Тик раз в секунду; на нуле — завершение по таймауту (ровно один раз).
  useEffect(() => {
    if (status !== 'run' || startedAt === null) return;
    let fired = false;
    const tick = () => {
      const left = getExamRemainingMs(Date.now());
      setRemaining(left);
      if (left <= 0 && !fired) {
        fired = true;
        finishExamSession('timeout');
      }
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [status, startedAt, durationMs, getExamRemainingMs, finishExamSession]);

  // Новый вопрос — новый выбор варианта.
  useEffect(() => {
    setSelectedIndex(null);
  }, [currentId]);

  const handleSubmit = () => {
    if (!question || selectedIndex === null) return;
    submitExamAnswer(question.id, selectedIndex);
    // Последний вопрос: store сам завершит прогон ('manual'), иначе двигаемся дальше.
    nextExamQuestion();
  };

  if (status !== 'run' || !question) {
    // Прогон не активен (reload стёр session-only состояние, либо прогон уже
    // завершён): показываем выход, а не пустой экран.
    return (
      <ScreenContainer data-testid="exam-run-empty">
        <h2
          data-testid="exam-question-text"
          style={{ fontSize: 'var(--heading-2)', fontWeight: 600, margin: 0 }}
        >
          Экзамен не запущен
        </h2>
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)' }}>
          Прогон не активен. Вернитесь на главную и выберите длину экзамена заново.
        </p>
        <button
          type="button"
          data-testid="exam-exit"
          onClick={cancelExamSession}
          style={{
            width: '100%',
            marginTop: SPACING.lg,
            padding: SPACING.md,
            background: 'var(--accent)',
            color: 'var(--btn-primary-text)',
            border: 'none',
            borderRadius: 'var(--btn-primary-radius)',
            fontSize: 'var(--body)',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          На главную
        </button>
      </ScreenContainer>
    );
  }

  const index = answersCount;

  return (
    <ScreenContainer data-testid="exam-run">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: SPACING.sm,
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
        }}
      >
        <span data-testid="exam-progress" style={{ fontWeight: 600 }}>
          {`Вопрос ${index + 1} / ${totalQuestions}`}
        </span>
        <span
          data-testid="exam-timer"
          aria-label="Осталось времени"
          style={{
            fontVariantNumeric: 'tabular-nums',
            fontWeight: 600,
            color: remaining <= 60000 ? 'var(--danger)' : 'var(--text-primary)',
          }}
        >
          {formatRemaining(remaining)}
        </span>
      </div>

      <h2
        data-testid="exam-question-text"
        style={{
          fontSize: 'var(--heading-2)',
          fontWeight: 600,
          lineHeight: 'var(--body-line-height)',
          margin: 0,
          marginTop: SPACING.lg,
        }}
      >
        {question.question}
      </h2>

      <div style={{ display: 'flex', flexDirection: 'column', gap: SPACING.md, marginTop: SPACING.lg }}>
        {question.options.map((option, optionIndex) => {
          const selected = selectedIndex === optionIndex;
          return (
            <button
              key={option.text}
              type="button"
              data-testid={`exam-option-${optionIndex}`}
              aria-pressed={selected}
              onClick={() => setSelectedIndex(optionIndex)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: SPACING.sm,
                width: '100%',
                padding: SPACING.md,
                background: selected ? 'rgba(33,150,243,0.08)' : 'var(--bg-elevated)',
                border: `2px solid ${selected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--card-radius)',
                color: 'var(--text-primary)',
                fontSize: 'var(--body)',
                lineHeight: 'var(--body-line-height)',
                textAlign: 'left',
                cursor: 'pointer',
                fontFamily: 'inherit',
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
                {String.fromCharCode(65 + optionIndex)}
              </span>
              <span>{option.text}</span>
            </button>
          );
        })}
      </div>

      {/* Sticky footer (spec 056): тот же паттерн, что и в Question.tsx — кнопка
          действия не должна уезжать ниже фолда, когда вопрос длинный.
          UX-фикс (Ф3): нижний запас = safe-area + var(--space-2), чтобы кнопки
          не уходили под адресную строку/жест-бар на живом мобильном. */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          zIndex: 10,
          marginTop: 'auto',
          paddingTop: SPACING.sm,
          paddingBottom: 'calc(var(--space-2) + env(safe-area-inset-bottom, 0px))',
          background: 'var(--bg-primary)',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <button
          type="button"
          data-testid="exam-submit"
          disabled={selectedIndex === null}
          onClick={handleSubmit}
          style={{
            width: '100%',
            marginTop: SPACING.md,
            padding: SPACING.md,
            background: selectedIndex === null ? 'var(--bg-surface)' : 'var(--accent)',
            color: selectedIndex === null ? 'var(--text-secondary)' : 'var(--btn-primary-text)',
            border: 'none',
            borderRadius: 'var(--btn-primary-radius)',
            fontSize: 'var(--body)',
            fontWeight: 600,
            cursor: selectedIndex === null ? 'not-allowed' : 'pointer',
            opacity: selectedIndex === null ? 0.5 : 1,
            fontFamily: 'inherit',
          }}
        >
          {index + 1 >= totalQuestions ? 'Завершить экзамен' : 'Ответить'}
        </button>

        <button
          type="button"
          data-testid="exam-cancel"
          onClick={cancelExamSession}
          style={{
            width: '100%',
            marginTop: SPACING.sm,
            padding: SPACING.sm,
            background: 'transparent',
            color: 'var(--text-secondary)',
            border: 'none',
            fontSize: 'var(--text-xs)',
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          Прервать и выйти
        </button>
      </div>
    </ScreenContainer>
  );
}
