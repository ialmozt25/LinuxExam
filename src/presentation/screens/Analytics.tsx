import { useMemo } from 'react';
import { AppHeader } from '@/presentation/components/AppHeader';
import { ScreenContainer } from '@/presentation/components/ScreenContainer';
import { SPACING } from '@/presentation/theme';
import { TOPICS } from '@/data/topics';
import { useAnalytics } from '@/store/analytics';
import { useQuizStore } from '@/store/quizStore';

/**
 * Analytics (spec 058) — «персональный тренер».
 *
 * Всё считается из локального прогресса: `questionStats` (persist) + банк.
 * Экран только рисует: radar по темам, крупная готовность, до трёх слабых зон и
 * тренд за 7 дней. Библиотек графиков нет — SVG собирается вручную, поэтому
 * число осей равно числу тем реестра (`TOPICS.length`), а не литералу 14:
 * новый слаг темы автоматически добавляет ось.
 *
 * Пустой профиль не даёт NaN: домен возвращает 0, а экран показывает
 * приглашение пройти первую сессию.
 */

const RADAR_SIZE = 260;
const RADAR_RADIUS = 104;
/** Нулевая готовность всё равно видна точкой в центре, а не «пропадает». */
const MIN_POINT_RADIUS = 4;

/** Координата точки на оси `index` из `count`, на радиусе `radius` от центра. */
function axisPoint(index: number, count: number, radius: number): { x: number; y: number } {
  const angle = (index / count) * Math.PI * 2 - Math.PI / 2;
  return {
    x: RADAR_SIZE / 2 + Math.cos(angle) * radius,
    y: RADAR_SIZE / 2 + Math.sin(angle) * radius,
  };
}

function toPoints(points: { x: number; y: number }[]): string {
  return points.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
}

const CARD: React.CSSProperties = {
  marginTop: SPACING.lg,
  padding: SPACING.md,
  border: '1px solid var(--border-subtle)',
  borderRadius: 'var(--radius-md)',
  background: 'var(--bg-secondary)',
};

const SECTION_TITLE: React.CSSProperties = {
  fontSize: 'var(--text-xs)',
  textTransform: 'uppercase',
  letterSpacing: '0.5px',
  color: 'var(--text-secondary)',
  fontWeight: 600,
  marginBottom: SPACING.sm,
};

export default function Analytics() {
  const navigateTo = useQuizStore((s) => s.navigateTo);
  // `now` фиксируется на монтировании: тренд за окно не «прыгает» между
  // рендерами, а домен остаётся детерминированным (spec 058).
  const now = useMemo(() => Date.now(), []);
  const { overall, byTopic, weak, trend, isEmpty } = useAnalytics(now);

  const percent = Math.round(overall * 100);
  const axes = TOPICS.map((topic) => topic.key);
  const values = axes.map((slug) => byTopic[slug] ?? 0);
  const radarPoints = values.map((value, i) =>
    axisPoint(i, Math.max(axes.length, 1), MIN_POINT_RADIUS + value * (RADAR_RADIUS - MIN_POINT_RADIUS))
  );
  const rings = [0.25, 0.5, 0.75, 1];

  const deltaLabel =
    trend.deltaPct === null
      ? 'нет базы для сравнения'
      : trend.deltaPct > 0
        ? `+${trend.deltaPct}%`
        : `${trend.deltaPct}%`;

  return (
    <ScreenContainer data-testid="analytics">
      {/* Выход (UX-фикс): тот же общий AppHeader, что у Question / Results /
          Paywall. До фикса «← На главную» лежала ПОСЛЕДНИМ блоком контента —
          на 390x844 она оказывалась под тремя карточками и радаром, то есть
          вне вьюпорта. Шапка возвращает выход в первый экран. */}
      <AppHeader
        onBack={() => navigateTo('dashboard')}
        center="Аналитика"
        right={
          <button
            type="button"
            data-testid="analytics-back"
            onClick={() => navigateTo('dashboard')}
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
          letterSpacing: '-0.5px',
          margin: 0,
          color: 'var(--text-primary)',
        }}
      >
        Аналитика
      </h1>

      {isEmpty && (
        <div
          data-testid="analytics-empty"
          style={{
            marginTop: SPACING.lg,
            padding: SPACING.lg,
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--card-radius)',
            textAlign: 'center',
          }}
        >
          <div aria-hidden="true" style={{ fontSize: 'var(--heading-xl)', lineHeight: 1 }}>
            📊
          </div>
          <h2
            style={{
              fontSize: 'var(--heading-2)',
              fontWeight: 700,
              margin: `${SPACING.md} 0 0 0`,
              color: 'var(--text-primary)',
            }}
          >
            Начните свой путь к RHCSA
          </h2>
          <p
            style={{
              fontSize: 'var(--body)',
              lineHeight: 'var(--body-line-height)',
              color: 'var(--text-secondary)',
              margin: `${SPACING.sm} 0 0 0`,
            }}
          >
            Пройдите первый тест, чтобы увидеть прогресс
          </p>
          <button
            type="button"
            data-testid="analytics-start"
            onClick={() => navigateTo('dashboard')}
            style={{
              width: '100%',
              marginTop: SPACING.lg,
              padding: SPACING.md,
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
            Начать тренировку
          </button>
        </div>
      )}

      {/* Метрики и радар скрыты, пока нет ни одного ответа: «Готовность 0 %» и
          радар из нулей — не данные, а шум на пустом профиле (spec 065, К5.1). */}
      {!isEmpty && (
        <>
          <div data-testid="analytics-readiness" style={{ marginTop: SPACING.lg }}>
            <div
              style={{
                fontSize: 'var(--heading-xl)',
                fontWeight: 700,
                color: 'var(--text-primary)',
                fontVariantNumeric: 'tabular-nums',
              }}
            >
              {`Готовность: ${percent}%`}
            </div>
            <p
              style={{
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                marginTop: SPACING.xs,
              }}
            >
              Взвешено по размеру тем: точность ответов × охват банка
            </p>
          </div>

          {/* Radar. Оси — темы реестра; нулевая тема остаётся видимой точкой в
              центре, поэтому «13 из 14 тем без ответов» не ломает картинку. */}
          <div style={{ marginTop: SPACING.lg, display: 'flex', justifyContent: 'center' }}>
            <svg
              data-testid="analytics-radar"
              role="img"
              aria-label={`Готовность по ${axes.length} темам`}
              viewBox={`0 0 ${RADAR_SIZE} ${RADAR_SIZE}`}
              width={RADAR_SIZE}
              height={RADAR_SIZE}
            >
              {rings.map((ring) => (
                <polygon
                  key={ring}
                  points={toPoints(
                    axes.map((_, i) => axisPoint(i, axes.length, RADAR_RADIUS * ring))
                  )}
                  fill="none"
                  stroke="var(--border-subtle)"
                  strokeWidth={1}
                />
              ))}
              {axes.map((_, i) => {
                const outer = axisPoint(i, axes.length, RADAR_RADIUS);
                return (
                  <line
                    key={i}
                    x1={RADAR_SIZE / 2}
                    y1={RADAR_SIZE / 2}
                    x2={outer.x}
                    y2={outer.y}
                    stroke="var(--border-subtle)"
                    strokeWidth={1}
                  />
                );
              })}
              <polygon
                data-testid="analytics-radar-shape"
                points={toPoints(radarPoints)}
                fill="var(--accent)"
                fillOpacity={0.25}
                stroke="var(--accent)"
                strokeWidth={2}
              />
              {radarPoints.map((point, i) => (
                <circle
                  key={i}
                  cx={point.x}
                  cy={point.y}
                  r={2.5}
                  fill="var(--accent)"
                  data-testid={`analytics-point-${axes[i]}`}
                />
              ))}
            </svg>
          </div>
        </>
      )}

      <div data-testid="analytics-weak" style={CARD}>
        <div style={SECTION_TITLE}>Слабые темы</div>
        {weak.length === 0 ? (
          <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', margin: 0 }}>
            Пока нечего показать — нет данных по темам
          </p>
        ) : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {weak.map((topic) => (
              <li
                key={topic.slug}
                data-testid={`analytics-weak-${topic.slug}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: SPACING.sm,
                  padding: `${SPACING.xs} 0`,
                  fontSize: 'var(--text-sm)',
                  color: 'var(--text-primary)',
                }}
              >
                <span>{topic.label}</span>
                <span
                  className="mono"
                  style={{ color: 'var(--text-secondary)', fontVariantNumeric: 'tabular-nums' }}
                >
                  {`${Math.round(topic.score * 100)}%`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div data-testid="analytics-trend" style={CARD}>
        <div style={SECTION_TITLE}>Тренд за 7 дней</div>
        <div
          style={{
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
            fontVariantNumeric: 'tabular-nums',
          }}
        >
          {`Отвечено: ${trend.answered}, верно: ${trend.correct}`}
        </div>
        <div
          data-testid="analytics-trend-delta"
          style={{
            fontSize: 'var(--text-sm)',
            fontWeight: 600,
            marginTop: SPACING.xs,
            color:
              trend.deltaPct === null
                ? 'var(--text-secondary)'
                : trend.deltaPct >= 0
                  ? 'var(--success)'
                  : 'var(--danger)',
          }}
        >
          {`Точность: ${deltaLabel}`}
        </div>
      </div>

    </ScreenContainer>
  );
}
