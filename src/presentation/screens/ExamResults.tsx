import { useQuizStore } from '@/store/quizStore';
import { AppHeader } from '@/presentation/components/AppHeader';
import { ScreenContainer } from '@/presentation/components/ScreenContainer';
import {
  FIXED_FOOTER_SPACER,
  FIXED_FOOTER_Z_INDEX,
  useFixedFooterPadding,
} from '@/presentation/components/fixedFooter';
import { SPACING, LAYOUT } from '@/presentation/theme';
import { EXAM_PASS_THRESHOLD } from '@/domain/exam';

/**
 * Exam mode (spec 054) — экран итогов.
 *
 * Итог считается доменом (`scoreExam`) по числу вопросов прогона: неотвеченный
 * вопрос — неверный, поэтому процент честный даже при завершении по таймауту.
 * Разбор по темам приходит из `breakdownByTopic` (тоже домен).
 */
export default function ExamResults() {
  const footerRef = useFixedFooterPadding();
  const getExamResult = useQuizStore((s) => s.getExamResult);
  const getExamBreakdown = useQuizStore((s) => s.getExamBreakdown);
  const finishReason = useQuizStore((s) => s.examSession.finishReason);
  const cancelExamSession = useQuizStore((s) => s.cancelExamSession);

  const score = getExamResult();
  const rows = getExamBreakdown();

  return (
    <ScreenContainer data-testid="exam-results">
      {/* Выход (UX-фикс): общий AppHeader, как в Analytics/Question/Results/Paywall.
          До фикса единственным выходом была кнопка `back-to-dashboard` ПОСЛЕ
          разбора по темам: на 390x844 прогон из 30 вопросов даёт длинный
          breakdown, и кнопка оказывалась видна лишь на 37.5% (замер E2E:
          viewport ratio 0.375). Существующий testid кнопки внизу не тронут —
          шапка добавлена сверху. */}
      <AppHeader
        onBack={cancelExamSession}
        center="Экзамен завершён"
        right={
          <button
            type="button"
            data-testid="exam-results-back"
            onClick={cancelExamSession}
            aria-label="На главную"
            style={{
              minWidth: 44,
              minHeight: 44,
              background: 'transparent',
              border: 'none',
              padding: 0,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              color: 'var(--btn-ghost-text)',
              fontSize: 'var(--text-sm)',
              fontFamily: 'inherit',
            }}
          >
            На главную
          </button>
        }
      />
      <h1
        style={{
          fontSize: 'var(--heading-1)',
          fontWeight: 700,
          letterSpacing: 'var(--letter-tight)',
          margin: 0,
          color: 'var(--text-primary)',
        }}
      >
        Экзамен завершён
      </h1>
      <p
        data-testid="exam-finish-reason"
        style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: SPACING.xs }}
      >
        {finishReason === 'timeout' ? 'Время вышло' : 'Завершено вручную'}
      </p>

      <div
        data-testid="exam-score"
        style={{
          fontSize: 'var(--heading-xl)',
          fontWeight: 700,
          marginTop: SPACING.lg,
          color: 'var(--text-primary)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {`${score.correct} / ${score.total} (${score.percent}%)`}
      </div>

      <div
        data-testid="exam-verdict"
        style={{
          marginTop: SPACING.sm,
          fontSize: 'var(--text-sm)',
          fontWeight: 700,
          color: score.passed ? 'var(--success)' : 'var(--danger)',
        }}
      >
        {score.passed ? '✅ Сдано' : '❌ Не сдано'}
      </div>
      <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: SPACING.xs }}>
        {`Порог сдачи — ${Math.round(EXAM_PASS_THRESHOLD * 100)}%`}
      </p>

      {rows.length > 0 && (
        <div data-testid="exam-breakdown" style={{ marginTop: SPACING.lg }}>
          <div
            style={{
              fontSize: 'var(--text-xs)',
              textTransform: 'uppercase',
              letterSpacing: 'var(--letter-wide)',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              marginBottom: SPACING.sm,
            }}
          >
            По темам
          </div>
          {rows.map((row) => (
            <div
              key={row.topic}
              data-testid={`exam-topic-${row.topic}`}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                gap: SPACING.sm,
                padding: `${SPACING.sm} 0`,
                borderBottom: '1px solid var(--border-subtle)',
                fontSize: 'var(--text-sm)',
              }}
            >
              <span style={{ color: 'var(--text-primary)' }}>{row.topic}</span>
              <span style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}>
                {`${row.correct} / ${row.total} (${row.percent}%)`}
              </span>
            </div>
          ))}
        </div>
      )}

      {rows.length === 0 && (
        <p
          data-testid="exam-breakdown-empty"
          style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: SPACING.lg }}
        >
          Нет ответов для разбора.
        </p>
      )}

      {/* spec 076 F4: CTA переведён в fixed-футер (образец spec 070). В потоке
          кнопка стоит после разбора по темам и на 640–720 px высотах уходила за
          сгиб (y=795…851, 3 случая сетки 075). */}
      <div
        ref={footerRef}
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: FIXED_FOOTER_Z_INDEX,
          paddingTop: SPACING.sm,
          paddingBottom: 'calc(var(--space-2) + env(safe-area-inset-bottom, 0px))',
          paddingLeft: 'calc(var(--space-4) + var(--safe-left))',
          paddingRight: 'calc(var(--space-4) + var(--safe-right))',
          background: 'var(--bg-primary)',
          borderTop: '1px solid var(--border-subtle)',
        }}
      >
        <button
          type="button"
          data-testid="back-to-dashboard"
          onClick={cancelExamSession}
          style={{
            width: '100%',
            padding: SPACING.md,
            // design-review-2: заливка — семантическая роль --btn-primary-bg
            // (= var(--accent)), а не примитив: тот же цвет по умолчанию, но
            // следует палитре Telegram, как у остальных primary-CTA.
            background: 'var(--btn-primary-bg)',
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
      </div>

      {/* Распорка под высоту fixed-футера (spec 070/076). */}
      <div data-testid="fixed-footer-spacer" style={FIXED_FOOTER_SPACER} />
    </ScreenContainer>
  );
}
