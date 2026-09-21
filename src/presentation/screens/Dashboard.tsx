import type { CSSProperties } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ShieldCheck, FolderOpen, Cpu } from 'lucide-react';
import { useQuizStore } from '@/store/quizStore';
import { COLORS, SPACING, LAYOUT } from '@/presentation/theme';
import { pluralizeQuestions } from '@/utils/pluralize';
import { StreakBadge } from '@/presentation/components/StreakBadge';
import { XpBar } from '@/presentation/components/XpBar';

// CSS fallback for browsers without dvh support (older Safari/Chrome).
// Two declarations of minHeight cannot coexist in one object literal (TS1117),
// so the vh fallback lives in its own object and is overridden by dvh via spread.
const VIEWPORT_MIN_HEIGHT_FALLBACK: CSSProperties = { minHeight: '100vh' };

export default function Dashboard() {
  const questions = useQuizStore((s) => s.questions);
  const navigateTo = useQuizStore((s) => s.navigateTo);

  // CRITICAL: useShallow with PRIMITIVES ONLY.
  // getProgress() returns a new object each call. useShallow on the full
  // object still re-renders because the object reference changes.
  // Solution: return only primitives from the selector.
  const { answered, completion } = useQuizStore(
    useShallow((s) => {
      const p = s.getProgress();
      return { answered: p.answered, completion: p.completion };
    })
  );

  const TOPICS = [
    { key: 'file_permissions' as const, title: 'Права доступа', Icon: ShieldCheck },
    { key: 'file_management' as const, title: 'Управление файлами', Icon: FolderOpen },
    { key: 'process_management' as const, title: 'Управление процессами', Icon: Cpu },
  ];

  return (
    <div
      style={{
        ...VIEWPORT_MIN_HEIGHT_FALLBACK,
        minHeight: '100dvh',
        background: COLORS.background,
        color: COLORS.textPrimary,
        padding: SPACING.md,
        maxWidth: LAYOUT.containerMaxWidth,
        margin: '0 auto',
      }}
    >
      <h1 style={{ fontSize: 28, fontWeight: 700, margin: 0 }}>Тренажёр RHCSA</h1>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: SPACING.md,
          marginTop: SPACING.sm,
        }}
      >
        <StreakBadge />
        <XpBar />
      </div>
      <p style={{ fontSize: 14, color: COLORS.textSecondary, marginTop: SPACING.xs }}>
        Подготовка к сертификации Linux
      </p>

      <div
        role="progressbar"
        aria-valuenow={completion}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Прогресс прохождения"
        style={{
          height: LAYOUT.progressBarHeight,
          background: COLORS.surface,
          borderRadius: LAYOUT.progressBarRadius,
          marginTop: SPACING.lg,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${completion}%`,
            height: '100%',
            background: COLORS.primary,
            borderRadius: LAYOUT.progressBarRadius,
            transition: 'width 0.3s ease',
          }}
        />
      </div>

      <p style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: SPACING.sm }}>
        {`Пройдено ${answered} из ${questions.length} ${pluralizeQuestions(questions.length)}`}
      </p>

      <div
        className="grid grid-cols-1 md:grid-cols-3"
        style={{ gap: SPACING.md, marginTop: SPACING.xl }}
      >
        {TOPICS.map(({ key, title, Icon }) => {
          const count = questions.filter((q) => q.topic === key).length;
          return (
            <button
              key={key}
              type="button"
              aria-label={`Перейти к теме: ${title}`}
              onClick={() => navigateTo('question')}
              style={{
                background: COLORS.surface,
                padding: SPACING.md,
                borderRadius: LAYOUT.cardRadius,
                cursor: 'pointer',
                textAlign: 'left',
                border: 'none',
                width: '100%',
                color: COLORS.textPrimary,
                transition: 'background 0.2s',
                fontFamily: 'inherit',
              }}
            >
              <Icon size={24} color={COLORS.primary} aria-hidden="true" />
              <div style={{ fontSize: 14, fontWeight: 600, marginTop: SPACING.sm }}>{title}</div>
              <div style={{ fontSize: 12, color: COLORS.textSecondary, marginTop: SPACING.xs }}>
                {`${count} ${pluralizeQuestions(count)}`}
              </div>
            </button>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => navigateTo('question')}
        style={{
          background: COLORS.primary,
          color: COLORS.textPrimary,
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
    </div>
  );
}
