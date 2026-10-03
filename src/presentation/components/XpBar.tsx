import { useDailyGoalProgress } from '@/store/dailyGoal';
import { SPACING, LAYOUT } from '@/presentation/theme';
import { xpBarColor } from '@/domain/goal';

/** Позиция визуальной засечки на шкале дневной цели (research: Duolingo, 85 %). */
const MARK_PERCENT = 85;

const FILL_VAR = {
  gray: 'var(--text-secondary)',
  accent: 'var(--accent)',
  green: 'var(--success)',
} as const;

/**
 * XP bar (spec 061) — прогресс К ДНЕВНОЙ ЦЕЛИ: `todayXp / dailyGoalXp`, текст
 * «15 / 20 XP» и визуальная засечка на 85 % («почти получилось» тянет завершение
 * лучше, чем порог 100 %; research: Duolingo).
 *
 * Уровень здесь НЕ дублируется: он уже показан в статус-полосе Dashboard
 * (`#status-strip`), а две копии «Уровень N» ломали бы строгий `getByText` в
 * существующих спеках (`persist.spec.ts`) и читались бы как дубль информации.
 */
export function XpBar() {
  const daily = useDailyGoalProgress();
  const percent = Math.round(daily.ratio * 100);
  const color = xpBarColor(daily.ratio);
  const fillColor = FILL_VAR[color];
  const markActive = daily.ratio >= MARK_PERCENT / 100;

  return (
    <div
      data-testid="xp-bar"
      data-xp-color={color}
      data-mark-active={markActive ? 'true' : 'false'}
      style={{ flex: 1, minWidth: 0 }}
    >
      <div
        data-testid="xp-bar-daily"
        role="img"
        aria-label={`Дневная цель: ${daily.todayXp} из ${daily.goalXp} XP`}
        style={{
          position: 'relative',
          height: LAYOUT.progressBarHeight,
          background: 'var(--bg-surface)',
          borderRadius: LAYOUT.progressBarRadius,
          overflow: 'hidden',
        }}
      >
        <div
          data-testid="xp-bar-fill"
          style={{
            width: `${percent}%`,
            height: '100%',
            background: fillColor,
            borderRadius: LAYOUT.progressBarRadius,
            transition: 'width 0.3s ease',
          }}
        />
        <span
          data-testid="xp-bar-mark"
          title="Почти получилось"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: `${MARK_PERCENT}%`,
            width: 2,
            background: markActive ? 'var(--success)' : 'var(--border-strong)',
          }}
        />
      </div>

      <div
        data-testid="xp-bar-daily-label"
        style={{
          marginTop: SPACING.xs,
          fontSize: 12,
          color: 'var(--text-secondary)',
          fontWeight: 600,
        }}
      >
        {`${daily.todayXp} / ${daily.goalXp} XP`}
      </div>
    </div>
  );
}
