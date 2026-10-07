import { useEffect, useMemo, useRef, type RefObject } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { BarChart3, BrainCircuit, ClipboardList, Flame, MoonStar, Sun, Target, Trophy } from 'lucide-react';
import { useQuizStore } from '@/store/quizStore';
import { pluralizeQuestions } from '@/utils/pluralize';
import { useTelegramMainButton } from '@/hooks/useTelegramMainButton';
import { ScreenContainer } from '@/presentation/components/ScreenContainer';
import { StreakBadge } from '@/presentation/components/StreakBadge';
import { Tux } from '@/ui/Tux';
import { XpBar } from '@/presentation/components/XpBar';
import { DailyGoalPicker } from '@/presentation/components/DailyGoalPicker';
import { Sidebar, type SidebarNavId } from '@/presentation/components/Sidebar';
import { useCanAccessTopic } from '@/store/paywall';
import { isFreeTopic } from '@/domain/paywall';
import { levelFromXp, nextLevel, xpInLevel } from '@/domain/xp';
import { TOPICS, AVAILABLE_TOPICS } from '@/data/topics';
import { getBankTotal, getTopicCount } from '@/data/questions';
import { Badge, Button, Card } from '@/ui';
import type { BadgeVariant } from '@/ui';
import type { ResolvedTheme } from '@/utils/theme';

interface Props {
  /** Theme currently in effect, owned by useThemeController in App. */
  theme: ResolvedTheme;
  /** Flips the theme, or returns to inherit when it matches the system one. */
  onToggleTheme: () => void;
}

/** Есть ли у пользователя доступ к теме целиком (spec 063). */
type TopicGate = (key: string) => boolean;

/**
 * Клик по теме (spec 063). Доступ есть — открывается существующий прогон
 * (`startTopicQuiz`); доступа нет (платная тема, `!isPro`, trial неактивен) —
 * поднимается контентный paywall. Логика Free-тем не меняется: они всегда
 * проходят по первой ветке.
 */
function openTopic(key: string, hasAccess: boolean) {
  const store = useQuizStore.getState();
  if (!hasAccess) {
    store.showPaywall();
    return;
  }
  store.startTopicQuiz(key);
}

/**
 * Основной CTA дашборда («Начать обучение» / «Продолжить обучение» /
 * «Продолжить изучение»). Вынесен в константу: три состояния должны выглядеть
 * одинаково, иначе одно и то же действие снова разъедется по стилям (spec 065).
 *
 * spec-фабрика (pilot): роль кнопки теперь в `src/ui/Button` (variant="primary"),
 * поэтому здесь остались только геометрия и раскладка содержимого. Цвета ушли в
 * контракт компонента: `--accent` + `--btn-primary-text` (spec 079).
 */
const PRIMARY_CTA: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

/** Правая подпись CTA: счётчик вопросов/тем. */
const CTA_COUNTER: React.CSSProperties = { fontSize: 'var(--text-xs)', fontWeight: 600 };

/**
 * Заголовок Hero свежего профиля. Вторая ступень шкалы, а не `--heading-1`:
 * `h1` на экране ровно один (название продукта), Hero — его подчинённый уровень.
 */
const HERO_TITLE: React.CSSProperties = {
  fontSize: 'var(--heading-2)',
  lineHeight: 1.25,
  fontWeight: 700,
  margin: 0,
  color: 'var(--text-primary)',
};

/**
 * CTA Hero: та же primary-кнопка, но крупнее и с подписью по центру — до первого
 * ответа это единственное действие экрана, а не одна из трёх равных веток.
 */
const HERO_CTA: React.CSSProperties = {
  justifyContent: 'center',
  padding: 'var(--space-4)',
  fontSize: 'var(--body)',
};

/**
 * «Внутри вас ждет» (Fresh User Mode): 4 возможности, 2×2.
 *
 * Иконки — SVG из lucide: эмодзи в блоке возможностей запрещены контрактом
 * (tell `slop-emoji-as-icon`, `scripts/fitness/check-slop.mjs`), и то же самое
 * требует само задание («только SVG-иконки»). Поэтому четыре пункта используют
 * BrainCircuit / BarChart3 / Target / Trophy, а не пиктограммы из задания.
 */
const FRESH_FEATURES = [
  { Icon: BrainCircuit, label: 'Умное повторение' },
  { Icon: BarChart3, label: 'Аналитика слабых тем' },
  { Icon: Target, label: 'Exam Mode (30/60/90)' },
  { Icon: Trophy, label: 'XP и уровни' },
] as const;

/**
 * «14 тем» / «2 темы» / «1 тема». Число берётся из реестра тем, а не литералом:
 * реестр растёт, и подпись обязана ехать вместе с ним — та же причина, по которой
 * `pluralizeQuestions` живёт отдельной утилитой, а ожидания e2e считают числа из
 * живого манифеста.
 */
function topicCountLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} тема`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} темы`;
  return `${count} тем`;
}

/**
 * Дневная цель по ОТВЕТАМ (задание «счётчик ответов за сегодня»). Числом
 * совпадает с размером сессии (`SESSION_LIMIT`), но смысл другой: это норма дня,
 * а не потолок одного прогона, поэтому константа независимая.
 */
const DAILY_ANSWER_GOAL = 30;

/**
 * Сколько держится уведомление «Ты теперь {уровень}!». Время, а не «до первого
 * действия»: событие приходит с экрана вопроса, и мгновенный сброс стёр бы его
 * раньше, чем пользователь вернётся на Dashboard.
 */
const LEVEL_UP_TOAST_MS = 5000;

/**
 * Правая часть CTA — счётчик ответов за сегодня (сброс в полночь):
 * 0 — день ещё не начат, показывается обещание дня; 1..30 — прогресс дня;
 * больше 30 — цель взята, остаётся только число.
 */
function dailyAnswerLabel(answered: number): string {
  if (answered <= 0) return `${DAILY_ANSWER_GOAL} вопросов`;
  if (answered <= DAILY_ANSWER_GOAL) return `${answered} из ${DAILY_ANSWER_GOAL} вопросов`;
  return `✓ ${answered}`;
}

/** Вторичный CTA: обводка акцентом, одинаковый для «Exam mode» и «Аналитика». */
const SECONDARY_CTA: React.CSSProperties = {
  marginTop: 'var(--space-4)',
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--space-2)',
};

/**
 * «Повторить ошибки»: красная подложка и рамка. Подложка — 10% от роли
 * `--danger` через color-mix (литерал `rgba(244,67,54,0.1)` дублировал RGB
 * токена и разъехался бы при его смене); мета-подпись берёт тёмную роль
 * `--color-danger-strong` (spec 079).
 */
const REVIEW_WRONG_BUTTON: React.CSSProperties = {
  background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
  border: '1px solid var(--danger)',
  color: 'var(--text-primary)',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
};

/**
 * Ключ ПЕРВОЙ доступной бесплатной темы (spec 065, К5.2).
 *
 * Считается из реестра, а не хардкодится: порядок тем — часть реестра, и при
 * перестановке/добавлении темы подсказка обязана переехать сама. Порядок
 * `isFreeTopic` (domain) — единственный источник правды о том, что бесплатно.
 */
const FIRST_FREE_TOPIC = TOPICS.find(
  (topic) => topic.status === 'available' && isFreeTopic(topic.key),
)?.key;

/**
 * «Скоро» — четвёртый случай того же каркаса (spec 067/079). Сам каркас,
 * minHeight 32px, обрезка и цвет тёмной роли акцента теперь в
 * `src/ui/Badge` (variant="locked"); здесь остались только различия
 * надписи: верхний регистр и разрядка.
 */
const LOCKED_BADGE: React.CSSProperties = {
  textTransform: 'uppercase',
  letterSpacing: 'var(--letter-wide)',
};

/**
 * Бейдж доступа в строке темы. Подпись и `variant` выводятся из ОДНОГО
 * предиката: до фикса подпись считалась по `isFree || allowed` («Бесплатно» и
 * для платной темы с доступом), а variant — по `isFree` (`pro`, синий), поэтому
 * одно и то же слово рисовалось двумя цветами (diag-dashboard-fix, симптом 1).
 *
 * Роли: бесплатная тема — БЕЗ бейджа; платная тема С доступом — тоже БЕЗ бейджа
 * (решение C, dashboard-ux-2: замок 🔒 убран из строки, доступ по клику);
 * платная БЕЗ доступа — плашка «PRO» (`pro`, `paywall-badge-pro`: отдельный
 * контракт spec 063, по тексту «PRO» платную строку находят `e2e/screens.ts` и
 * `ux-screenshots.tmp`); тема со статусом `planned` — «Скоро» (`locked`).
 *
 * Строка платной темы с доступом визуально идентична free-строке — это и есть
 * требование решения C.
 */
interface TopicBadge {
  testid?: string;
  label: string;
  variant: BadgeVariant;
}

/**
 * RHCSA-программа: информационный список тем банка. Строки не интерактивны как
 * навигация — клик по доступной теме запускает её прогон (`openTopic`), у
 * платной темы без доступа поднимается paywall.
 *
 * Отдельный компонент, а не блок внутри Dashboard, потому что список рендерится
 * УСЛОВНО (Fresh User Mode его не показывает), а внутри строки вызывается
 * paywall-хук `useCanAccessTopic`. Число хуков внутри одного компонента обязано
 * быть постоянным: условный блок с хуком в `.map` ломал бы правила хуков при
 * переключении режима без размонтирования («Rendered more hooks than during the
 * previous render»). Внутри этого компонента `TOPICS` статичен, поэтому набор
 * хуков одинаков на каждом его рендере.
 */
function RhcsaProgramme({
  topicsRef,
}: {
  /** Анкер списка: цель скролла CTA «Начать обучение» в ветке без онбординга. */
  topicsRef: RefObject<HTMLDivElement>;
}) {
  // Paywall (spec 063): подписка на примитивы `isPro`/`trialStartedAt`.
  const paywallAccess: TopicGate = useCanAccessTopic;

  /* B2 (сетка тем): классы — только от `lg`. Безусловные `grid grid-cols-1
     gap-4` из задания сменили бы отступ строк на мобильном (там 1 колонка и
     `--space-2`, а `gap-4` дал бы 16+8), а мобильный layout менять нельзя
     (задание: «Мобильный и планшетный layout НЕ меняются»). Ниже 1024px узел
     остаётся прежним блочным контейнером.
     Число колонок — по аудиту (`desktop-audit/report.json`): три колонки при 1024
     давали карточку 224px и текстовую колонку 108px, где обрезались 9 названий
     тем из 14 и ВСЕ 14 описаний (23 узла); при 1440/1920 обрезок нет. Поэтому от
     `lg` — две колонки (при 1024 карточка 344px, текстовая колонка ≈216px, как у
     363px-карточки на 1440), а третья возвращается от `xl` (1280). */
  return (
    <div
      id="dashboard-topics"
      data-testid="dashboard-topics"
      ref={topicsRef}
      className="lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-4 lg:items-start"
      style={{ marginTop: 'var(--space-6)' }}
    >
      {/* Шапка списка — не карточка: в сетке тем занимает всю строку при любом
          числе колонок (2 на lg, 3 на xl). */}
      <div
        className="lg:col-span-full"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'baseline',
          marginBottom: 'var(--space-3)',
        }}
      >
        <span
          style={{
            fontSize: 'var(--text-xs)',
            textTransform: 'uppercase',
            letterSpacing: 'var(--letter-wide)',
            color: 'var(--text-secondary)',
            fontWeight: 600,
          }}
        >
          Программа RHCSA
        </span>
        <span
          style={{
            fontSize: 'var(--text-xs)',
            color: 'var(--text-secondary)',
          }}
        >
          {`${AVAILABLE_TOPICS.length} из ${TOPICS.length} тем`}
        </span>
      </div>

      {TOPICS.map((topic) => {
        const count = getTopicCount(topic.key);
        const isAvailable = topic.status === 'available';
        const Icon = topic.Icon;
        // spec 063: Free-темы открыты всем, Paid-темы — только Pro или активным
        // trial-ом. Тема со статусом «Скоро» остаётся неинтерактивной: доступ
        // для неё не считается, бейджа нет.
        const isFree = isFreeTopic(topic.key);
        const allowed = !isAvailable || paywallAccess(topic.key);
        // Решение C (dashboard-ux-2): замок 🔒 у платной темы убран — доступ
        // определяется кликом (free / Pro / активный trial). Бейдж остаётся
        // только у платной темы БЕЗ доступа: «PRO» — это её paywall-метка.
        const badge: TopicBadge | null =
          !isAvailable || isFree || allowed
            ? null
            : { testid: 'paywall-badge-pro', label: 'PRO', variant: 'pro' };

        // Строка темы. Поверхность и hover живут на ОБЁРТКЕ (классы C3/D1):
        // `Card` задаёт фон inline-стилем, а inline-стиль перебил бы и класс
        // уровня яркости, и `:hover` (hover в inline-стиле запрещён Contract).
        // Поэтому фон карточки здесь — `transparent`, а поверхность рисует
        // обёртка с тем же радиусом.
        const rowStyle = {
          display: 'flex' as const,
          alignItems: 'center' as const,
          gap: 'var(--space-3)',
          padding: 'var(--space-3)',
          background: 'transparent',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          width: '100%' as const,
          textAlign: 'left' as const,
          fontFamily: 'inherit',
          color: 'inherit',
        };

        // Обёртка строки: уровень яркости и приглушение недоступной темы.
        // `opacity` переехала с карточки на обёртку вместе с фоном: иначе
        // приглушались бы текст и рамка, а поверхность осталась бы полной
        // яркости — регресс вида «Скоро» на мобильном. Отступ между строками —
        // классами (`mb-[var(--space-2)] lg:mb-0`): в сетке ритм задаёт `gap`, и
        // лишние 8px сделали бы вертикальный шаг (24px) в полтора раза больше
        // горизонтального (16px).
        const rowSurfaceStyle = {
          borderRadius: 'var(--radius-md)',
          ...(isAvailable ? {} : { opacity: 0.55 }),
        };

        const inner = (
          <>
            <Icon
              size={20}
              color={isAvailable ? 'var(--accent)' : 'var(--text-secondary)'}
              aria-hidden="true"
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Название и подсказка (spec 067): подсказка идёт СРАЗУ за
                  названием в отдельной колонке, а не в общем ряду с чипом
                  вопросов. `flexWrap: wrap` роняет её на свою строку, когда
                  места не хватает (390px + длинное название темы), вместо
                  того чтобы распирать карточку по горизонтали. */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 'var(--space-1) var(--space-2)',
                  flexWrap: 'wrap',
                  minWidth: 0,
                }}
              >
                <div
                  style={{
                    fontSize: 'var(--text-sm)',
                    fontWeight: 600,
                    color: 'var(--text-primary)',
                    minWidth: 0,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {topic.title}
                </div>
                {topic.key === FIRST_FREE_TOPIC && (
                  <Badge variant="hint" testId="topic-first-cta">
                    начните с этой
                  </Badge>
                )}
              </div>
              <div
                style={{
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-secondary)',
                  marginTop: 'var(--space-1)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {topic.description}
              </div>
            </div>
            {/* Правая колонка: чип доступа и счётчик. `flexWrap` — чтобы на узком
                экране они переносились вниз, а не выдавливали название. */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 'var(--space-1)',
                flexShrink: 0,
                maxWidth: '45%',
              }}
            >
              {/* `LOCKED_BADGE` (капс + разрядка) — только для плашки «PRO»:
                  после решения C это единственный бейдж в строке темы. */}
              {badge !== null && (
                <Badge variant={badge.variant} testId={badge.testid} style={LOCKED_BADGE}>
                  {badge.label}
                </Badge>
              )}
              {isAvailable ? (
                <span
                  style={{
                    fontSize: 'var(--text-xs)',
                    fontWeight: 600,
                    // spec 079: 12px на белом — 3.12:1 при пороге 4.5:1 →
                    // тёмный оттенок акцента (5.75:1). Аудит 2026-10-07: на
                    // тёмной поверхности тот же примитив давал 3.23:1, поэтому
                    // здесь текстовая РОЛЬ акцента (light — сам примитив,
                    // dark — его светлый оттенок, 6.11:1 на `--surface-1`).
                    color: 'var(--text-accent)',
                    flexShrink: 0,
                  }}
                >
                  {count} вопр.
                </span>
              ) : (
                <Badge variant="locked" style={LOCKED_BADGE}>
                  Скоро
                </Badge>
              )}
            </div>
          </>
        );

        if (isAvailable) {
          return (
            <div
              key={topic.key}
              /* Hover: к заливке (`--surface-1` → `--surface-2`, тон-шаг всего
                 1.08:1 в тёмной теме) добавлен некрасочный признак — 1px-контур
                 роли акцента (6.11:1 на поверхности). Состояние hover не может
                 жить только в тоне: WCAG 1.4.11 требует 3:1, а тон на тёмной
                 поверхности до 3:1 не дотягивается. */
              className="bg-[color:var(--surface-1)] lg:hover:bg-[color:var(--surface-2)] lg:hover:ring-1 lg:hover:ring-[color:var(--text-accent)] transition-colors mb-[var(--space-2)] lg:mb-0"
              /* Название и описание темы обрезаются ellipsis (в полосе
                 1280–1339px описание ещё режется), а мышь обрезанный текст не
                 вернёт: `title` даёт подсказку. На обёртке, а не на `Card`:
                 `Card` не принимает произвольные атрибуты, а `src/ui/**` в этой
                 задаче править нельзя. */
              title={topic.title}
              style={rowSurfaceStyle}
            >
              <Card
                variant="plain"
                as="button"
                testId={`topic-${topic.key}`}
                onClick={() => openTopic(topic.key, allowed)}
                ariaLabel={`Начать тему: ${topic.title}`}
                style={rowStyle}
              >
                {inner}
              </Card>
            </div>
          );
        }

        return (
          <div
            key={topic.key}
            className="bg-[color:var(--surface-1)] mb-[var(--space-2)] lg:mb-0"
            style={rowSurfaceStyle}
          >
            <Card variant="plain" style={rowStyle}>
              {inner}
            </Card>
          </div>
        );
      })}
    </div>
  );
}

export default function Dashboard({ theme, onToggleTheme }: Props) {
  // Counts come from the bank manifest (≈260 B) rather than from the loaded bank:
  // the Dashboard must show real numbers before the topic chunks arrive.
  const navigateTo = useQuizStore((s) => s.navigateTo);
  const streak = useQuizStore((s) => s.streak);
  const totalXp = useQuizStore((s) => s.totalXp);
  // Празднование нового уровня — runtime-состояние стора: в персист НЕ
  // попадает, поэтому после reload оно пустое и toast не повторяется.
  const pendingLevelUp = useQuizStore((s) => s.pendingLevelUp);
  const clearPendingLevelUp = useQuizStore((s) => s.clearPendingLevelUp);
  const isQuizInProgress = useQuizStore((s) => s.isQuizInProgress);
  const currentIndex = useQuizStore((s) => s.currentIndex);
  const reviewQuestionIds = useQuizStore((s) => s.reviewQuestionIds);
  const resumeQuiz = useQuizStore((s) => s.resumeQuiz);
  const wrongQuestionIds = useQuizStore((s) => s.wrongQuestionIds);
  const startReviewQuiz = useQuizStore((s) => s.startReviewQuiz);

  // FSRS-lite (spec 052): нагрузка для кнопки входа в занятие.
  // Банк отдаёт store асинхронно (per-topic chunks), поэтому N пересчитывается
  // на каждый его приход — до загрузки банка review-today просто не показывается.
  const bankIds = useQuizStore(useShallow((s) => s.questions.map((question) => question.id)));
  const questions = useQuizStore((s) => s.questions);
  const scheduledReviews = useQuizStore((s) => s.scheduledReviews);
  const questionStats = useQuizStore((s) => s.questionStats);
  const ensureReviewsInitialized = useQuizStore((s) => s.ensureReviewsInitialized);
  const getSessionIds = useQuizStore((s) => s.getSessionIds);
  // Дневной счётчик ответов — правая часть CTA (см. `dailyAnswerLabel`).
  const todayAnswered = useQuizStore((s) => s.todayAnswered);

  // Одна сессия — до SESSION_LIMIT вопросов, просроченные первыми (spec 065).
  // Пересчитывается на каждый приход банка (per-topic chunks) и на каждое
  // изменение реестра расписания: ответ в прогоне сдвигает `next` в будущее.
  const sessionIds = useMemo(
    () => getSessionIds(),
    [getSessionIds, scheduledReviews, bankIds],
  );
  // ux-copy-3 (2026-10-07): `counts` (getSessionCounts) жил ровно ради узла
  // `review-today-remainder` — подсчёт хвоста пула ушёл вместе с ним. Размер
  // текущей сессии по-прежнему считается ниже (sessionDueIds/sessionNewIds).

  // Просроченные из отобранной сессии: порядок внутри сессии уже «сначала самые
  // запущенные», поэтому фильтр сохраняет порядок. Остаток за пределами сессии
  // считает экран Results — здесь важно только то, что будет пройдено сейчас.
  const dueIdSet = useMemo(
    () => new Set(questions.filter((q) => scheduledReviews[q.id] !== undefined).map((q) => q.id)),
    [questions, scheduledReviews],
  );
  const sessionDueIds = sessionIds.filter((id) => dueIdSet.has(id));
  const sessionNewIds = sessionIds.filter((id) => !dueIdSet.has(id));
  // Числа берутся из отобранной сессии, а не из общего пула: при пуле больше
  // SESSION_LIMIT сессия обещает ровно то, что откроет.
  const dueCount = sessionDueIds.length;
  const newCount = sessionNewIds.length;
  // ux-copy-3-fix (2026-10-07) считал здесь размер СЛЕДУЮЩЕЙ сессии
  // (`sessionSize`) — ровно для правой части CTA. Задание «счётчик ответов за
  // сегодня» заменило её дневным счётчиком ответов, поэтому `sessionSize` больше
  // не вычисляется: сессию по-прежнему собирает `getSessionIds()` (до
  // SESSION_LIMIT), а её границы ниже — `dueCount`/`newCount`.

  // Профиль без единого ответа: показываем приглашение, а не «повторить».
  // Условие — пустая статистика, а не пустой реестр расписания: реестр
  // до-наполняется при монтировании (ensureReviewsInitialized НИЖЕ) и на свежем
  // профиле выглядит так же полным, как у активного пользователя.
  const hasNoHistory = Object.keys(questionStats).length === 0;

  // Fresh User Mode: ответов ещё нет — это и есть первый запуск приложения.
  // Dashboard показывает только нужное (level-strip, Hero, «Внутри вас ждет»,
  // ОДНА CTA) и прячет Exam mode, аналитику, повтор ошибок и программу RHCSA: до
  // первого ответа этот выбор — шум, а единственное осмысленное действие одно.
  //
  // Флаг `hasCompletedOnboarding` из условия УБРАН (задание «удалить демо-квиз»):
  // единственным местом, где он выставлялся в `true`, был `completeOnboarding()` на
  // удалённом демо-экране, поэтому оставленный флаг сделал бы режим недостижимым
  // навсегда — fresh-профиль видел бы полный Dashboard вместо Hero. Сам флаг и
  // экшен в persist/сторе сохранены: их пинят `onboarding-migration.test.ts`
  // и `paywall-migration.test.ts`.
  //
  // Источник «есть ли ответы» — та же `questionStats`, что и раньше: статистика
  // накапливается во ВСЕХ потоках (regular, review, exam), поэтому первый же ответ
  // в любом из них выключает режим.
  const isFreshUser = hasNoHistory;

  // «Начать обучение» ведёт не в прогон, а к списку тем: это ветка профиля,
  // который ещё НЕ проходил онбординг (в ней список тем виден). У Fresh User Mode
  // список тем скрыт, поэтому его CTA стартует занятие напрямую — см. ниже.
  const topicsRef = useRef<HTMLDivElement | null>(null);
  const scrollToTopics = () => {
    topicsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  /**
   * Навигация десктопного сайдбара (задание «десктопный layout», блок A).
   *
   * Каждый пункт ведёт на СУЩЕСТВУЮЩЕЕ место продукта: `dashboard` — возврат к
   * началу скролл-контейнера (`#root` — он скроллер приложения, тот же узел, что
   * сбрасывает эффект ниже), `topics` — штатный анкер списка тем, `exam` и
   * `analytics` — существующие экраны через `navigateTo`. Пункт «Настройки»
   * экрана не имеет (`Screen` в `quizStore` не содержит `settings`), поэтому его
   * и не обрабатывает: сайдбар помечает такой пункт неинтерактивным.
   */
  const handleSidebarNav = (id: SidebarNavId) => {
    if (id === 'dashboard') {
      const el =
        document.getElementById('root') ?? document.scrollingElement ?? document.documentElement;
      el.scrollTop = 0;
      return;
    }
    if (id === 'topics') {
      scrollToTopics();
      return;
    }
    if (id === 'exam') {
      navigateTo('exam-setup');
      return;
    }
    if (id === 'analytics') {
      navigateTo('analytics');
    }
  };

  // Реестр расписания до-наполняется «пора сейчас» ровно один раз на банк:
  // экшен идемпотентен и возвращает тот же объект, когда заполнять нечего.
  useEffect(() => {
    ensureReviewsInitialized(bankIds);
  }, [ensureReviewsInitialized, bankIds]);

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

  // spec 072: in-app фолбэк CTA (sticky-футер `dashboard-continue`) удалён
  // заданием «убрать sticky-футер на Dashboard» — в браузере низ экрана пуст, а в
  // Telegram низ занимает нативная MainButton (hook ниже, не тронут). Поэтому
  // `useMainButtonAvailable()` здесь больше не нужен: высота футера не измерялась
  // и раньше (spec 076 F3), распорка не заводилась по контракту spec 071.

  // XP-дубли (diag-dashboard-fix, решение капитана STOP-1 v1): узел
  // `retention-goal-line` («Цель: X / Y XP») удалён — дневную цель уже
  // показывает подпись XpBar, третья копия тех же чисел была дублем.
  // Вместе с узлом ушёл и селектор `useDailyGoalProgress`: он был нужен только
  // ему, а незанятый импорт держал бы ложную зависимость от dailyGoal.
  // Нативный MainButton доступен только в Telegram и показывал бы «Продолжить»
  // даже в Fresh User Mode — то есть вторую primary-CTA против контракта «одна
  // большая кнопка до первого ответа». Там он скрыт: роль единственной CTA берёт
  // in-app `start-learning` в потоке.
  useTelegramMainButton('Продолжить', () => navigateTo('question'), true, !isFreshUser);

  // Reset scroll when the dashboard mounts.
  useEffect(() => {
    const el =
      document.getElementById('root') ?? document.scrollingElement ?? document.documentElement;
    el.scrollTop = 0;
  }, []);

  // Показ «Ты теперь {уровень}!»: уведомление живёт, пока его видно, и гасится
  // из стора — иначе оно всплывало бы при каждом заходе на Dashboard. Таймер
  // снимается при размонтировании: уведомление дождётся следующего визита, а не
  // пропадёт вместе с экраном (событие приходит с экрана вопроса).
  useEffect(() => {
    if (pendingLevelUp === null) return;
    const id = window.setTimeout(() => clearPendingLevelUp(), LEVEL_UP_TOAST_MS);
    return () => window.clearTimeout(id);
  }, [pendingLevelUp, clearPendingLevelUp]);


  const totalQuestions = getBankTotal();
  const progressPercent = totalQuestions > 0 ? (answered / totalQuestions) * 100 : 0;
  // Уровень и прогресс внутри него — домен (`src/domain/xp.ts`), а не арифметика
  // на месте: лестница «Новичок → … → Гранд-мастер» (0/50/150/350/700/1200/2000)
  // — контракт XP-механики, и вторая её копия здесь разошлась бы с той, по
  // которой начисляется XP. Подпись уровня — ИМЯ, а не номер: «Новичок» читается
  // без расшифровки, а «Уровень 4» — нет.
  const level = levelFromXp(totalXp);
  const levelProgress = xpInLevel(totalXp);
  const xpPercent = levelProgress.percent;
  // «До следующего» существует только ниже верхней ступени: у Гранд-мастера
  // `needed === null` и следующей ступени нет — числа показывать не от чего.
  // Фраза берёт РОДИТЕЛЬНЫЙ падеж имени (`nextLevelStep.nameGenitive`): «до
  // Ученика», а не «до Ученик».
  const nextLevelStep = nextLevel(totalXp);

  return (
    <ScreenContainer>
      {/* Десктопный слой (A/B): сайдбар слева, колонка контента — не шире
          1248px. Классы — только от `lg`: ниже 1024px обёртка становится обычным
          блоком (`lg:flex` не действует), поэтому мобильная и планшетная вёрстка —
          это ТЕ ЖЕ узлы с прежней геометрией (A5). Безусловные
          `max-w-[1248px] mx-auto px-6 w-full` из B1 добавили бы 24px к паддингу
          `ScreenContainer` (там уже `--space-4` + safe-area) и сдвинули бы
          мобильный layout, который задание запрещает менять.
          Центрируется ПАРА (рейл + колонка), а не одна колонка: `lg:max-w-[1488px]`
          = 240 + 1248, поэтому при 1920 отступы 216/216 (аудит 9be3442 показывал
          16 слева против 216 справа — 200px мёртвой полосы между рейлом и
          контентом). При 1440 доступно 1408 < 1488 — cap не действует, базлайн не
          плывёт. `lg:flex-1` тянет слой на всю высоту `ScreenContainer`: иначе в
          Fresh User Mode (короткий контент) `border-r` рейла обрывался на середине
          экрана. */}
      <div
        className="lg:flex lg:flex-1 lg:max-w-[1488px] lg:mx-auto"
        style={{ width: '100%', minWidth: 0 }}
      >
        {/* Гейты навигации повторяют гейты экрана: в Fresh User Mode список тем
            скрыт, а Exam/Аналитика намеренно не предлагаются первым шагом, и
            пункт не должен вести туда, куда поток не ведёт. «Настройки»
            недоступны всегда — экрана `settings` в продукте нет. */}
        <Sidebar
          active="dashboard"
          onNavigate={handleSidebarNav}
          disabled={isFreshUser ? ['topics', 'exam', 'analytics'] : []}
        />
        {/* Колонка контента — ориентир `main`: в проекте не было ни одного
            `main`/`role="main"`, поэтому навигация по лендмаркам была
            асимметричной (`aside` без пары). Рейл остаётся СНАРУЖИ. */}
        <main
          className="lg:max-w-[1248px] lg:px-6"
          style={{ display: 'flex', flexDirection: 'column', width: '100%', minWidth: 0 }}
        >
          {/* Status strip */}
          <div
            id="status-strip"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingBottom: 'var(--space-2)',
              borderBottom: '1px solid var(--border-subtle)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
            }}
          >
            {/* Серия (streak) НЕ дублируется здесь: она живёт в StreakBadge ниже,
                где есть число, состояние и мотивирующее сообщение. В status-strip
                остаются только уровень и полоса прогресса (UX-фикс). */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>{level.name}</span>
              {/* diag-dashboard-fix (симптом 5): полоса показывает XP ВНУТРИ уровня
                  (`xpInLevel`), а не дневную цель, и в отчёте это читалось как
                  «Уровень 1 · 10 %» рядом с дневной целью 10/20. Метрика оставлена:
                  дневную цель уже показывает XpBar, а вторая дневная полоса была бы
                  тем же дублем XP, против которого симптом 6. Неоднозначность снята
                  ИМЕНЕМ уровня, а не номером: «Новичок» рядом с «49 / 50 XP до
                  Ученика» читается без расшифровки, а «Уровень 4» — нет.
                  XP-механика: метрика та же, но уровень считается доменом по
                  именованной лестнице (`LEVELS`), а не `totalXp % 100`. */}
              <span
                role="progressbar"
                aria-valuenow={Math.round(xpPercent)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Уровень ${level.name}, XP внутри ${Math.round(xpPercent)}%`}
                style={{
                  display: 'inline-block',
                  width: 'var(--track-width-sm)',
                  height: 'var(--track-height)',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--track-radius)',
                  overflow: 'hidden',
                }}
              >
                <span
                  style={{
                    display: 'block',
                    width: '100%',
                    height: '100%',
                    background: 'var(--accent)',
                    transform: `scaleX(${xpPercent / 100})`,
                    transformOrigin: 'left',
                    transition: 'transform var(--duration-normal) ease',
                  }}
                />
              </span>
              {/* B3: числа «сколько осталось» — мелко и только когда следующий
                  уровень существует. На Гранд-мастере текста нет вообще: полоса
                  стоит на 100 %, и «до следующего» обещало бы то, чего нет. */}
              {levelProgress.needed !== null && nextLevelStep !== null ? (
                <span
                  data-testid="level-next"
                  style={{ fontSize: 'var(--text-xs)', color: 'var(--text-secondary)' }}
                >
                  {`${levelProgress.current} / ${levelProgress.needed} XP до ${nextLevelStep.nameGenitive}`}
                </span>
              ) : null}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Button
                variant="ghost"
                testId="theme-toggle"
                onClick={onToggleTheme}
                ariaLabel={
                  theme === 'light' ? 'Переключить на тёмную' : 'Переключить на светлую'
                }
                style={{ cursor: 'pointer' }}
              >
                {theme === 'light' ? (
                  <Sun size={20} color="var(--text-secondary)" aria-hidden="true" />
                ) : (
                  <MoonStar size={20} color="var(--text-secondary)" aria-hidden="true" />
                )}
              </Button>
            </div>
          </div>

          {/* Празднование нового уровня: показывается ровно один раз — пока
              `pendingLevelUp` не пуст. Стиль — существующая карточка
              (`Card variant="plain"`, как у resume-баннера): новых UI-примитивов не
              заводим. `role="status"` объявляет переход скринридеру, не забирая
              фокус. */}
          {pendingLevelUp !== null ? (
            <Card
              variant="plain"
              testId="level-up-toast"
              style={{
                border: 'none',
                marginTop: 'var(--space-4)',
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-2)',
              }}
            >
              <span role="status" style={{ fontSize: 'var(--text-sm)', fontWeight: 600 }}>
                {`Ты теперь ${pendingLevelUp.toName}!`}
              </span>
            </Card>
          ) : null}

          {/* Title block. ux-copy-3 (2026-10-07): маскот переехал из streak-бейджа
              сюда — рядом с названием и ПЕРЕД текстом заголовка (gap = --space-2).
              Картинка декоративная (alt="" + aria-hidden внутри <Tux>), поэтому
              доступное имя h1 остаётся «LinuxExam» (его читает ux-regression). */}
          <div style={{ marginTop: 'var(--space-5)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
              <Tux size={24} />
              <h1
                style={{
                  fontSize: 'var(--heading-1)',
                  fontWeight: 700,
                  letterSpacing: 'var(--letter-tight)',
                  margin: 0,
                  color: 'var(--text-primary)',
                }}
              >
                LinuxExam
              </h1>
            </div>
            <p
              data-testid="dashboard-subtitle"
              style={{
                fontSize: 'var(--body)',
                color: 'var(--text-secondary)',
                margin: 'var(--space-2) 0 0 0',
              }}
            >
              Подготовка к RHCSA за 15 минут в день
            </p>
          </div>

          {/* Retention-зона (spec 061): streak badge + XP bar с дневной целью рядом.
              В Fresh User Mode зоны нет ЦЕЛИКОМ (задание «продающий Fresh Dashboard»):
              у профиля без единого ответа оба узла показывали нули — бейдж «0 дней» и
              полоса «0 / 30 XP». Прежняя заглушка «Начни серию сегодня» закрывала
              только первый из двух нулей, поэтому ушла вместе с зоной. Возвращается
              сама после первого ответа: условие — та же `questionStats`, что и у всего
              режима. */}
          {!isFreshUser && (
            <div
              id="dashboard-retention"
              data-testid="dashboard-retention"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                marginTop: 'var(--space-5)',
              }}
            >
              <StreakBadge />
              <XpBar />
            </div>
          )}
          {/* diag-dashboard-fix (STOP-1 v1): узел `retention-goal-line`
              («Цель: X / Y XP») удалён по решению капитана — дневную цель уже
              показывает подпись XpBar («X / Y XP»), третий узел с теми же числами
              был дублем XP (симптом 6). */}

          {/* Progress. В Fresh User Mode скрыт: «0 из 253» — ноль, который новому
              пользователю ничего не сообщает (число вопросов уже есть в Hero, но как
              обещание, а не как «ты не сделал ничего из»). Скрыт условно, а не
              удалён: у возвращающегося профиля полоса остаётся его прогрессом. */}
          {!isFreshUser && (
            <div id="dashboard-progress" data-testid="dashboard-progress" style={{ marginTop: 'var(--space-5)' }}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: 'var(--text-sm)',
                  textTransform: 'uppercase',
                  letterSpacing: 'var(--letter-wide)',
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
                  marginTop: 'var(--space-2)',
                  height: 'var(--track-height)',
                  background: 'var(--bg-surface)',
                  borderRadius: 'var(--track-radius)',
                  overflow: 'hidden',
                }}
              >
                <div
                  style={{
                    width: '100%',
                    height: '100%',
                    background: 'var(--accent)',
                    transform: `scaleX(${progressPercent / 100})`,
                    transformOrigin: 'left',
                    transition: 'transform var(--duration-normal) ease',
                  }}
                />
              </div>
            </div>
          )}

          {/* Вход в занятие (spec 065; взаимоисключение ветвей — spec 066).
              Две ветки, порядок важен:
              1. Профиль без единого ответа (`hasNoHistory`) — приглашение к обучению.
                 Кнопка ОДНА, а обработчик зависит от режима: в Fresh User Mode
                 (`isFreshUser` — онбординг пройден, ответов нет) список тем скрыт,
                 поэтому CTA СТАРТУЕТ занятие (review-сессия дня), а в ветке без
                 пройденного онбординга скроллит к списку тем — он там виден.
                 В рантайме вторая ветка недостижима (App уводит такой профиль на
                 демо-квиз), но её контракт пинит юнит-тест `Dashboard.cta.test.tsx`.
              2. Профиль с историей: просроченные — повторение; остались только новые —
                 продолжение. Прогон идёт review-стримом, поэтому бесплатный лимит не
                 расходуется.

              Продающий Fresh Dashboard (задание): в ветке 1 свежий профиль получает
              Hero с ценностью вместо шести нулей, но кнопка остаётся ОДНА и общая для
              обеих подветок — две primary-кнопки в одном блоке рендера это ровно
              находка `duplicate-primary` из `scripts/fitness/check-styling.mjs`.
              testId `start-learning` сохранён намеренно: это контракт «единственный
              вход в занятие до первого ответа», и его пинят вне allowed-списка
              `e2e/analytics.spec.ts` и `e2e/regression-071.spec.ts` (им важен testId,
              а не подпись).

              ИЗВЕСТНЫЙ ДОЛГ (решение капитана на STOP-точке — оставить как есть):
              подветка `hasNoHistory && !isFreshUser` (подпись «Начать обучение» со
              счётчиком тем, onClick = scrollToTopics) после уборки демо НЕДОСТИЖИМА —
              isFreshUser теперь тождественно равен hasNoHistory.
              // unreachable после removal of demo (B1: isFreshUser ≡ hasNoHistory).
              // Убрать вместе со scrollToTopics/topicsRef/RhcsaProgramme.topicsRef отдельной задачей. */}
          {hasNoHistory ? (
            <>
              {/* Hero (только Fresh User Mode). Возвращающемуся профилю не рендерится:
                  у него ниже ветка «Продолжить обучение» с реальными числами. */}
              {isFreshUser && (
                <div data-testid="dashboard-hero" style={{ marginTop: 'var(--space-6)' }}>
                  <h2 style={HERO_TITLE}>Начните путь к RHCSA</h2>
                  <p
                    data-testid="dashboard-hero-subtitle"
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--text-secondary)',
                      margin: 'var(--space-2) 0 0 0',
                    }}
                  >
                    {`${totalQuestions} ${pluralizeQuestions(totalQuestions)} · ${topicCountLabel(TOPICS.length)} · по официальным objectives`}
                  </p>
                </div>
              )}
              {/* B3: та же мера ширины, что у CTA потока ниже — правило «primary
                  не растягивается на всю колонку» (B3) относится и к Hero-кнопке
                  Fresh User Mode: на 1440/1920 она занимала 704/1200px. Обёртка
                  блочная ниже `lg`, поэтому мобильный Hero не меняется. */}
              <div className="lg:max-w-md">
                <Button
                  variant="primary"
                  testId="start-learning"
                  onClick={isFreshUser ? () => startReviewQuiz(sessionIds, 'today') : scrollToTopics}
                  style={isFreshUser ? HERO_CTA : PRIMARY_CTA}
                >
                  {isFreshUser ? (
                    <span>Начать первый вопрос →</span>
                  ) : (
                    <>
                      <span>Начать обучение</span>
                      <span style={CTA_COUNTER}>{`${TOPICS.length} тем`}</span>
                    </>
                  )}
                </Button>
              </div>
              {/* «Внутри вас ждет» — тоже только Fresh User Mode: возвращающемуся
                  профилю эти механики уже знакомы, их несут Exam mode, аналитика и
                  StreakBadge ниже, а список из четырёх пунктов продавал бы купившему. */}
              {isFreshUser && (
                <div data-testid="dashboard-features" style={{ marginTop: 'var(--space-5)' }}>
                  <div
                    style={{
                      fontSize: 'var(--text-sm)',
                      textTransform: 'uppercase',
                      letterSpacing: 'var(--letter-wide)',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Внутри вас ждет
                  </div>
                  <ul
                    style={{
                      listStyle: 'none',
                      margin: 'var(--space-2) 0 0 0',
                      padding: 0,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                      gap: 'var(--space-2) var(--space-3)',
                    }}
                  >
                    {FRESH_FEATURES.map(({ Icon, label }) => (
                      <li
                        key={label}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-2)',
                          fontSize: 'var(--text-sm)',
                          color: 'var(--text-secondary)',
                        }}
                      >
                        <Icon size={16} aria-hidden="true" />
                        <span>{label}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          ) : (
            <>
              {dueCount > 0 ? (
                /* B3: на десктопе CTA не растягивается на всю колонку 1248px —
                   иначе primary-кнопка читается как полоса. Ниже `lg` обёртка
                   блочная и не меняет ни ширину, ни отступы кнопки. */
                <div className="lg:max-w-md">
                  <Button
                    variant="primary"
                    testId="review-today"
                    onClick={() => startReviewQuiz(sessionDueIds, 'today')}
                    style={PRIMARY_CTA}
                  >
                    {/* ux-copy-3 (2026-10-07): подпись «Повторить сегодня» читалась как
                        долг перед приложением — главный текст «Продолжить обучение».
                        ux-copy-3-fix (2026-10-07): «15 минут · 30 вопросов» был хардкодом
                        обещания; правая часть показывала реальное число вопросов
                        следующей сессии (`sessionSize`) и скрывалась целиком, если
                        показывать нечего (N = 0).
                        Задание «счётчик ответов за сегодня» вернуло правой части смысл
                        обещания, но дневного: N — это ОТВЕТЫ за сегодня (сброс в
                        полночь), а не размер следующей сессии. На N = 0 подпись читается
                        как прежде (цель дня численно равна размеру сессии = 30), дальше —
                        «N из 30». Скрывать больше нечего: счётчик есть всегда. */}
                    <span>Продолжить обучение</span>
                    <span style={CTA_COUNTER} data-testid="cta-counter">{dailyAnswerLabel(todayAnswered)}</span>
                  </Button>
                </div>
              ) : null}

              {newCount > 0 && dueCount === 0 ? (
                /* B3: на десктопе CTA не растягивается на всю колонку 1248px —
                   иначе primary-кнопка читается как полоса. Ниже `lg` обёртка
                   блочная и не меняет ни ширину, ни отступы кнопки. */
                <div className="lg:max-w-md">
                  <Button
                    variant="primary"
                    testId="continue-learning"
                    onClick={() => startReviewQuiz(sessionNewIds, 'today')}
                    style={PRIMARY_CTA}
                  >
                    <span>{`Продолжить изучение (${newCount})`}</span>
                    <span style={CTA_COUNTER}>{`${newCount} вопр.`}</span>
                  </Button>
                </div>
              ) : null}

              {/* ux-copy-3 (2026-10-07): хвост пула за одной сессией больше не
                  подписывается вовсе. Строка «Следующее повторение: завтра»
                  (UX-фикс 2026-10-07) удалена целиком вместе с узлом
                  `review-today-remainder` и его `data-fsrs-remaining`: обещание
                  «завтра» ничего не сообщало пользователю, а размер хвоста жил в DOM
                  только ради тестов. Фактический размер сессии виден в счётчике
                  прогона (`1 / N`). */}
            </>
          )}

          {/* Exam mode (spec 054) — единственный экзамен в приложении (spec 068):
              отдельный поток из трёх экранов (настройка → прогон → итоги) с пресетами
              30/60/90 и разбором по темам. Историческая кнопка «Режим экзамена
              (20 вопросов, 30 минут)» удалена вместе с инлайн-режимом.

              В Fresh User Mode скрыт: экзамен на 30–90 вопросов — не первый шаг для
              профиля без единого ответа. */}
          {!isFreshUser && (
            <>
              {/* B3 (продолжение): ширина действия задаётся одним местом — иначе главная
                  CTA (448px) оказалась бы у́же второстепенных кнопок во всю колонку 1120px.
              */}
              <div className="lg:max-w-md">
                <Button
                  variant="secondary"
                  testId="exam-mode"
                  onClick={() => navigateTo('exam-setup')}
                  style={SECONDARY_CTA}
                >
                  <ClipboardList size={18} aria-hidden="true" />
                  <span>Exam mode — 30/60/90 вопросов с разбором</span>
                </Button>
              </div>

              {/* Analytics (spec 058): «персональный тренер» — radar по 14 темам,
                  готовность, слабые зоны и тренд за 7 дней. Данные уже в persist
                  (questionStats), поэтому экран ничего не дозагружает.

                  В Fresh User Mode скрыта: аналитика по ПУСТОЙ статистике — пустые
                  состояния вместо ответа «где я слаб». */}
              {/* B3 (продолжение): ширина действия задаётся одним местом — иначе главная
                  CTA (448px) оказалась бы у́же второстепенных кнопок во всю колонку 1120px.
              */}
              <div className="lg:max-w-md">
                <Button
                  variant="secondary"
                  testId="analytics-mode"
                  onClick={() => navigateTo('analytics')}
                  style={SECONDARY_CTA}
                >
                  <BarChart3 size={18} aria-hidden="true" />
                  <span>Аналитика — готовность, слабые темы, тренд</span>
                </Button>
              </div>
            </>
          )}

          {/* «Повторить ошибки» — resumed from the regular stream's wrong answers.
              В Fresh User Mode ошибок ещё нет по определению, но узел скрыт явно:
              список «нужного» в этом режиме закрыт, и полагаться на пустоту ошибок
              вместо явного условия — хрупко. */}
          {!isFreshUser && wrongQuestionIds.length > 0 && (
              /* B3 (продолжение): ширина действия задаётся одним местом — иначе главная
                 CTA (448px) оказалась бы у́же второстепенных кнопок во всю колонку 1120px.
              */
              <div className="lg:max-w-md">
                <Button
                  variant="primary"
                  testId="review-wrong"
                  onClick={() => startReviewQuiz(wrongQuestionIds)}
                  style={REVIEW_WRONG_BUTTON}
                >
                  <span>Повторить ошибки</span>
                  <span
                    style={{
                      fontSize: 'var(--text-sm)',
                      color: 'var(--color-danger-strong)',
                      fontWeight: 600,
                    }}
                  >
                    {wrongQuestionIds.length} вопр.
                  </span>
                </Button>
              </div>
          )}

          {/* RHCSA-программа. В Fresh User Mode скрыта: до первого ответа список из
              14 тем — выбор без основания (пользователь ещё не знает, где слаб), а
              единственная CTA режима ведёт в занятие напрямую, а не к списку. */}
          {!isFreshUser && <RhcsaProgramme topicsRef={topicsRef} />}
          {/* Resume banner - unfinished regular quiz only */}
          {isQuizInProgress && !reviewQuestionIds ? (
            <Card
              variant="plain"
              testId="resume-banner"
              style={{
                border: 'none',
                marginTop: 'var(--space-4)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: 'var(--space-3)',
              }}
            >
              <div>
                <div style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>Тест не завершён</div>
                <div
                  data-testid="resume-position"
                  style={{
                    fontSize: 'var(--text-xs)',
                    color: 'var(--text-secondary)',
                    marginTop: 'var(--space-0-5)',
                  }}
                >
                  {`Вопрос ${currentIndex + 1} из ${totalQuestions}`}
                </div>
              </div>
              {/* diag-dashboard-fix (симптом 3): баннер и нижний футер показывали ДВЕ
                  primary-CTA с одинаковой подписью «Продолжить», когда прогон не
                  закончен и нативный MainButton недоступен. Кнопка баннера переведена
                  в secondary: обработчик (`resumeQuiz`) и подпись прежние — их пинят
                  e2e-контракты (paywall.spec.ts:84 кликает именно её, а фикстура
                  `resumeSeededRun` используется 7 спеками). Нижний футер
                  (`dashboard-continue`) удалён заданием «убрать sticky-футер», поэтому
                  primary на экране ровно один — верхняя CTA, а эта кнопка остаётся
                  единственным входом «вернуться к незавершённому прогону».
                  Вариант «баннер без CTA» отклонён по той же причине: `resume-button`
                  — публичный data-testid. */}
              <Button
                variant="secondary"
                testId="resume-button"
                onClick={resumeQuiz}
                style={{
                  width: 'auto',
                  padding: 'var(--space-2) var(--space-3)',
                  marginTop: 0,
                  borderRadius: 'var(--btn-secondary-radius)',
                  fontSize: 'var(--text-xs)',
                }}
              >
                Продолжить
              </Button>
            </Card>
          ) : null}

          {/* Вход в регулярный поток вне Telegram (spec 072) жил здесь: sticky-футер
              с primary-кнопкой «Продолжить» (`dashboard-continue`). Удалён целиком
              (задание «убрать sticky-футер на Dashboard»): в браузере он дублировал
              верхнюю CTA и нарушал «одна primary на экран» (DESIGN.md → Components).
              Вход в занятие теперь один — верхняя CTA (`start-learning` /
              `review-today` / `continue-learning`), возобновление незавершённого
              прогона — вторичная кнопка resume-баннера (`resume-button`), а в
              Telegram низ экрана по-прежнему занимает нативная MainButton
              (`useTelegramMainButton` ниже — не тронут). */}

          {/* Legal disclaimer — trademark safety (independent trainer notice).
              В Fresh User Mode скрыт: задание требует «никаких юридических текстов на
              первом экране», и юридический текст там действительно не продаёт.
              Из продукта НЕ удалён: экрана Settings/About пока не существует
              (`Screen` — 9 значений, legal-экрана среди них нет), а уведомление о
              торговых марках нужно продукту, а не только первому экрану. Поэтому оно
              остаётся у возвращающегося профиля и переедет на отдельный экран, когда
              тот появится (решение капитана на STOP-точке, B1 в полном виде не
              выполнялся). */}
          {/* TODO: move to Settings when screen exists */}
          {!isFreshUser && (
            <div
              data-disclaimer="legal"
              style={{
                marginTop: 'var(--space-6)',
                paddingTop: 'var(--space-3)',
                borderTop: '1px solid var(--border-subtle)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-secondary)',
                lineHeight: 1.5,
              }}
            >
              LinuxExam — независимый тренажёр. Не аффилирован с Red Hat, Inc. и CompTIA.
              RHCSA® — торговая марка Red Hat, Inc. CompTIA® и Linux+® — торговые марки CompTIA.
              Вопросы оригинальные, основаны на публично доступных exam objectives.
            </div>
          )}

          {/* Показывается ровно один раз: после онбординга и до подтверждения цели. */}
          <DailyGoalPicker />
        </main>
      </div>
    </ScreenContainer>
  );
}
