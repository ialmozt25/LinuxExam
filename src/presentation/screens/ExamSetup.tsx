import { useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useQuizStore } from '@/store/quizStore';
import { ScreenContainer } from '@/presentation/components/ScreenContainer';
import { AppHeader } from '@/presentation/components/AppHeader';
import { SPACING } from '@/presentation/theme';
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
      {/* Единая шапка (spec 065, К4.2). До неё здесь была самописная кнопка
          «← Назад» с ArrowLeft size=18 — третий вариант возврата в приложении.
          Контракт testid сохранён: exam-setup-back остаётся на выходе. */}
      <AppHeader
        onBack={() => navigateTo('dashboard')}
        center="Exam mode"
        right={
          <button
            type="button"
            data-testid="exam-setup-back"
            onClick={() => navigateTo('dashboard')}
            aria-label="Назад"
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
            Назад
          </button>
        }
      />

      <h1
        style={{
          fontSize: 'var(--heading-1)',
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
                borderRadius: 'var(--btn-secondary-radius)',
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
          // spec 079: белый текст на акценте — 3.12:1 при пороге 4.5:1.
          background: canStart ? 'var(--color-accent-strong)' : 'var(--bg-surface)',
          color: canStart ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
          border: 'none',
          borderRadius: 'var(--btn-primary-radius)',
          fontSize: 'var(--body)',
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
