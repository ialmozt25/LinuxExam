import { useEffect } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { ShieldCheck, FolderOpen, Cpu, Flame } from 'lucide-react';
import { useQuizStore } from '@/store/quizStore';
import { COLORS, SPACING, LAYOUT } from '@/presentation/theme';
import { pluralizeQuestions } from '@/utils/pluralize';
import { isTMA } from '@telegram-apps/sdk-react';
import { useTelegramMainButton } from '@/hooks/useTelegramMainButton';
import { ScreenContainer } from '@/presentation/components/ScreenContainer';

export default function Dashboard() {
  const questions = useQuizStore((s) => s.questions);
  const navigateTo = useQuizStore((s) => s.navigateTo);
  const streak = useQuizStore((s) => s.streak);
  const totalXp = useQuizStore((s) => s.totalXp);

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

  useTelegramMainButton('Продолжить', () => navigateTo('question'));

  // Reset scroll when the dashboard mounts.
  useEffect(() => {
    const el =
      document.getElementById('root') ?? document.scrollingElement ?? document.documentElement;
    el.scrollTop = 0;
  }, []);

  const TOPICS = [
    { key: 'file_permissions' as const, title: 'Права доступа', Icon: ShieldCheck },
    { key: 'file_management' as const, title: 'Управление файлами', Icon: FolderOpen },
    { key: 'process_management' as const, title: 'Управление процессами', Icon: Cpu },
  ];

  const totalQuestions = questions.length;
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
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
          RHCSA · COMPTIA LINUX+
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

      {!isTelegram && (
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
      )}
    </ScreenContainer>
  );
}
