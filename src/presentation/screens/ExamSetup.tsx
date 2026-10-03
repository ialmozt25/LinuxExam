import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ArrowLeft } from 'lucide-react';
import { useQuizStore } from '@/store/quizStore';
import { ScreenContainer } from '@/presentation/components/ScreenContainer';
import { SPACING, LAYOUT } from '@/presentation/theme';
import { EXAM_PASS_THRESHOLD, EXAM_PRESETS } from '@/domain/exam';

/**
 * Exam mode (spec 054) — экран настройки.
 *
 * Пользователь выбирает пресет (30/60/90 вопросов), видит длительность и порог
 * сдачи и запускает прогон. Пустой банк (вопросы ещё не загрузились) блокирует
 * старт: запускать нечего.
 */
export default function ExamSetup() {
  const navigateTo = useQuizStore((s) => s.navigateTo);
  const startExamSession = useQuizStore((s) => s.startExamSession);
  const bankIds = useQuizStore(useShallow((s) => s.questions.map((question) => question.id)));
  const [count, setCount] = useState<number>(EXAM_PRESETS[0].count);

  const preset = EXAM_PRESETS.find((p) => p.count === count) ?? EXAM_PRESETS[0];
  const available = Math.min(preset.count, bankIds.length);
  const canStart = bankIds.length > 0;

  return (
    <ScreenContainer data-testid="exam-setup">
      <button
        type="button"
        data-testid="exam-setup-back"
        onClick={() => navigateTo('dashboard')}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: SPACING.sm,
          minHeight: 44,
          padding: `${SPACING.sm} 0`,
          background: 'transparent',
          border: 'none',
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-sm)',
          fontWeight: 600,
          cursor: 'pointer',
          fontFamily: 'inherit',
          alignSelf: 'flex-start',
        }}
      >
        <ArrowLeft size={18} aria-hidden="true" /> Назад
      </button>

      <h1
        style={{
          fontSize: '24px',
          fontWeight: 700,
          letterSpacing: '-0.5px',
          margin: `${SPACING.md} 0 0 0`,
          color: 'var(--text-primary)',
        }}
      >
        Exam mode
      </h1>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', marginTop: SPACING.xs }}>
        Пробный экзамен без подсказок и объяснений. Порог сдачи —{' '}
        {Math.round(EXAM_PASS_THRESHOLD * 100)}%.
      </p>

      <div
        role="radiogroup"
        aria-label="Длина экзамена"
        style={{ display: 'flex', flexDirection: 'column', gap: SPACING.sm, marginTop: SPACING.lg }}
      >
        {EXAM_PRESETS.map((p) => {
          const selected = p.count === count;
          const minutes = Math.round(p.durationMs / 60000);
          return (
            <button
              key={p.count}
              type="button"
              role="radio"
              aria-checked={selected}
              data-testid={`preset-${p.count}`}
              onClick={() => setCount(p.count)}
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: SPACING.md,
                width: '100%',
                padding: SPACING.md,
                background: selected ? 'rgba(33,150,243,0.10)' : 'var(--bg-surface)',
                border: `1px solid ${selected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                borderRadius: 'var(--radius-md)',
                color: 'var(--text-primary)',
                fontFamily: 'inherit',
                fontSize: 'var(--text-sm)',
                cursor: 'pointer',
                textAlign: 'left',
              }}
            >
              <span style={{ fontWeight: 600 }}>{`${p.count} вопросов`}</span>
              <span style={{ color: 'var(--text-secondary)', fontSize: 'var(--text-xs)' }}>
                {`${minutes} минут`}
              </span>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        data-testid="exam-start"
        disabled={!canStart}
        onClick={() => startExamSession(preset, bankIds)}
        style={{
          width: '100%',
          marginTop: SPACING.lg,
          padding: SPACING.md,
          background: canStart ? 'var(--accent)' : 'var(--bg-surface)',
          color: 'var(--text-primary)',
          border: 'none',
          borderRadius: LAYOUT.buttonRadius,
          fontSize: 16,
          fontWeight: 600,
          cursor: canStart ? 'pointer' : 'not-allowed',
          opacity: canStart ? 1 : 0.5,
          fontFamily: 'inherit',
        }}
      >
        Начать экзамен
      </button>

      <p
        data-testid="exam-setup-summary"
        style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginTop: SPACING.sm }}
      >
        {canStart
          ? `Вопросов в прогоне: ${available} из банка ${bankIds.length}`
          : 'Банк вопросов ещё загружается'}
      </p>
    </ScreenContainer>
  );
}
