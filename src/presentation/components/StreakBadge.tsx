import { Flame } from 'lucide-react';
import { useQuizStore } from '@/store/quizStore';
import { SPACING, LAYOUT } from '@/presentation/theme';

export function StreakBadge() {
  const streak = useQuizStore((s) => s.streak);

  if (streak <= 0) return null;

  return (
    <div
      role="status"
      aria-label={`Серия ${streak} дней`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: SPACING.xs,
        background: 'var(--bg-surface)',
        color: 'var(--text-primary)',
        padding: `${SPACING.xs} ${SPACING.sm}`,
        borderRadius: LAYOUT.buttonRadius,
        fontSize: 14,
        fontWeight: 600,
        flexShrink: 0,
      }}
    >
      <Flame size={16} color={'var(--accent)'} aria-hidden="true" />
      <span>{streak}</span>
    </div>
  );
}