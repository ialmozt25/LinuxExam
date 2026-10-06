import { useQuizStore } from '@/store/quizStore';
import { useStreakState } from '@/store/dailyGoal';
import { SPACING, LAYOUT } from '@/presentation/theme';
import { messageColor, pluralDays } from '@/domain/goal';

/** Размер бейджа серии (spec 061, К3): квадрат ≈80×80. */
const BADGE_SIZE = 80;

/**
 * Streak badge (spec 061). Retention-вид: крупное число дней + слово серии.
 *
 * ux-copy-3 (2026-10-07): маскот Tux уехал из бейджа в заголовок Dashboard
 * (`<Tux size={24} />` рядом с «LinuxExam»), а мотивационная подпись
 * `streakMessage` («День 1 — хорошее начало», «5 дней подряд») заменена словом
 * серии под числом — «день / дня / дней подряд» через доменный `pluralDays`.
 * Число больше не дублируется текстом: оно стоит крупно над подписью, подпись
 * несёт только форму слова. `streakMessage` остаётся в домене (её собственный
 * контракт и её тесты не тронуты) — бейдж её больше не рендерит.
 *
 * ux-copy-3-fix (2026-10-07): рамка бейджа больше не зависит ни от состояния
 * серии, ни от темы — один цвет `var(--color-accent-strong)` в light и dark, на
 * mobile и desktop. Числовое значение токена и замеры по контекстам — в
 * docs/memory/episodic.md (hex в .tsx запрещён правилом no-hex-in-tsx).
 *
 * Состояние считается по сегодняшней активности, а не по одной длине серии:
 * active (сегодня занимались) → green, warning (последняя активность вчера) →
 * orange, broken (раньше) → red. `messageColor` остаётся домен-классификацией
 * длины серии и пишется в `data-streak-color`.
 *
 * Тестовый контракт прежний: `role="status"`, `aria-label="Серия N <день|дня|дней>"`
 * (слово согласуется с числом через `pluralDays`, dashboard-ux-2) и число
 * отдельным текстовым узлом.
 */
export function StreakBadge() {
  const streak = useQuizStore((s) => s.streak);
  const todayXp = useQuizStore((s) => s.todayXp);
  const navigateTo = useQuizStore((s) => s.navigateTo);
  const state = useStreakState();

  // ux-copy-3-fix (2026-10-07): рамка бейджа — ОДИН цвет во всех контекстах.
  // Раньше она шла от состояния серии (`--success`/`--warning`/`--danger`), а
  // `--theme-success`/`--theme-danger` в tokens.css заданы РАЗНЫМИ значениями для
  // light и dark — бейдж выглядел по-разному на телефоне и на десктопе. Взята
  // фиксированная примитивная роль акцента `--color-accent-strong`: объявлена
  // один раз в `:root` и темами не переопределяется. `--accent` не годится — он
  // Telegram-aware (`var(--tg-theme-button-color, …)`), `--warning` запрещён
  // заданием. Задание называло токен `var(--color-accent)`; такого в tokens.css
  // нет, значение совпадает именно с `--color-accent-strong` (числа обеих тем и
  // замеры — в docs/memory/episodic.md).
  // Слово серии под числом: 1 → «день подряд», 2–4 → «дня подряд»,
  // 5+ → «дней подряд». Согласование — домен, здесь правило не дублируется.
  const caption = `${pluralDays(streak)} подряд`;
  // Домен вызывается для полноты контракта (классификация длины серии), но
  // показываемый цвет берётся из сегодняшнего состояния.
  const streakColor = messageColor(streak);

  return (
    // `role="status"` живёт на обёртке, а не на кнопке: axe запрещает
    // `role="status"` на `<button>` (aria-allowed-role), а тестовый контракт
    // «role="status" + aria-label "Серия N дней"» сохранён (слово согласуется
    // с числом: 1 → «день», 2 → «дня», 5 → «дней»).
    <div
      role="status"
      aria-label={`Серия ${streak} ${pluralDays(streak)}`}
      style={{ flexShrink: 0 }}
    >
      <button
        type="button"
        data-testid="streak-badge"
        data-streak-state={state}
        data-streak-color={streakColor}
        aria-label={`Серия ${streak} ${pluralDays(streak)}`}
        onClick={() => navigateTo('analytics')}
        style={{
          width: BADGE_SIZE,
          // min-height, а не height: содержимое (число + слово серии) может
          // попросить больше 80px, и фиксированная высота обрезала бы нижнюю
          // строку подписи (историческая регрессия пилота: scrollHeight 84 vs
          // clientHeight 78). 80px остаётся МИНИМУМОМ тап-зоны (spec 067, К3),
          // а не потолком: при коротком содержимом блок выглядит как раньше,
          // при длинном — растёт вместо обрезки. Вариант с обрезкой текста
          // (ellipsis / line-clamp) отклонён: подпись — часть мотивации, а не
          // метка (ux-copy-3 сузил её до слова серии, правило оставлено).
          minHeight: BADGE_SIZE,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 'var(--space-1)',
          padding: 'var(--space-1)',
          // Высота считается от рамки: 80px включают padding и border, поэтому
          // контент получает 80 − 2×4 − 2×1 = 70px и не выходит наружу.
          boxSizing: 'border-box',
          flexShrink: 0,
          background: 'var(--bg-surface)',
          color: 'var(--text-primary)',
          border: '1px solid var(--color-accent-strong)',
          borderRadius: LAYOUT.cardRadius,
          cursor: 'pointer',
          fontFamily: 'inherit',
        }}
      >
        {/* ux-copy-3: цифра — акцент бейджа (font-weight 700, яркий
            --text-primary, кегль заголовка). Задание называло токен
            `--heading-lg`; такого токена в tokens.css нет (`--heading-2` 20px,
            `--heading-1` 28px, `--heading-xl` 40px), а новый токен — правка
            design-системы вне скоупа задачи, поэтому взят ближайший
            существующий шаг выше прежнего `--text-xl` (24px). */}
        <span
          style={{
            fontSize: 'var(--heading-1)',
            fontWeight: 700,
            lineHeight: 1,
            color: 'var(--text-primary)',
          }}
        >
          {streak}
        </span>
        <span
          style={{
            fontSize: 'var(--text-sm)',
            lineHeight: 1.4,
            textAlign: 'center',
            color: 'var(--text-secondary)',
          }}
        >
          {caption}
        </span>
      </button>
    </div>
  );
}
