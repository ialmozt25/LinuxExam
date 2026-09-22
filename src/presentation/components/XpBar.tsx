import { useQuizStore } from '@/store/quizStore';
import { COLORS, SPACING, LAYOUT } from '@/presentation/theme';

export function XpBar() {
  const totalXp = useQuizStore((s) => s.totalXp);
  const level = Math.floor(totalXp / 100) + 1;
  const progress = totalXp % 100;

  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 12,
          color: 'var(--text-secondary)',
          marginBottom: SPACING.xs,
        }}
      >
        <span>{`Уровень ${level}`}</span>
        <span>{`${totalXp} XP`}</span>
      </div>

      <div
        role="progressbar"
        aria-valuenow={progress}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Опыт"
        style={{
          height: LAYOUT.progressBarHeight,
          background: 'var(--bg-surface)',
          borderRadius: LAYOUT.progressBarRadius,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: '100%',
            background: `linear-gradient(90deg,${'var(--accent)'},${COLORS.correct})`,
            borderRadius: LAYOUT.progressBarRadius,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  );
}